#!/usr/bin/env python3
"""Starter DESEN 0.1.0 validator and conformance runner.

This tool intentionally favors readable reference behavior over speed. It covers
all bundled conformance vectors and a useful subset of semantic checks. A
production publisher/runtime still needs stronger type-flow, policy, resource,
and adapter validation.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Iterator

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError

ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = {
    "source": ROOT / "schemas" / "desen-source.schema.json",
    "bundle": ROOT / "schemas" / "desen-bundle.schema.json",
    "catalog": ROOT / "schemas" / "desen-catalog.schema.json",
}


@dataclass(frozen=True)
class Diagnostic:
    code: str
    path: str
    message: str
    category: str

    def __str__(self) -> str:
        suffix = f" at {self.path}" if self.path else ""
        return f"{self.code}{suffix}: {self.message}"


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def pointer(parts: Iterable[Any]) -> str:
    encoded = []
    for part in parts:
        text = str(part).replace("~", "~0").replace("/", "~1")
        encoded.append(text)
    return "/" + "/".join(encoded) if encoded else ""


def schema_diagnostics(document: Any, target: str) -> list[Diagnostic]:
    schema = load_json(SCHEMAS[target])
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(document), key=lambda e: list(e.absolute_path))
    diagnostics: list[Diagnostic] = []
    for error in errors:
        code = "UNKNOWN_CORE_FIELD" if error.validator == "additionalProperties" else "SCHEMA_INVALID"
        diagnostics.append(
            Diagnostic(
                code=code,
                path=pointer(error.absolute_path),
                message=error.message,
                category="schema_error",
            )
        )
    return diagnostics


def check_schemas() -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    for target, path in SCHEMAS.items():
        schema = load_json(path)
        try:
            Draft202012Validator.check_schema(schema)
        except SchemaError as error:
            diagnostics.append(
                Diagnostic(
                    code="SCHEMA_INVALID",
                    path=f"schemas/{path.name}{pointer(error.absolute_path)}",
                    message=error.message,
                    category="schema_error",
                )
            )
    return diagnostics


def node_digest(mode: str, path: Path) -> str:
    helper = ROOT / "tools" / "jcs.mjs"
    try:
        result = subprocess.run(
            ["node", str(helper), mode, str(path)],
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as error:
        raise RuntimeError("Node.js is required for RFC 8785 digest verification") from error
    except subprocess.CalledProcessError as error:
        raise RuntimeError(error.stderr.strip() or "Digest helper failed") from error
    return result.stdout.strip()


def embedded_schema_diagnostics(catalog: dict[str, Any]) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    groups: list[tuple[str, dict[str, Any], tuple[str, ...]]] = [
        ("components", catalog.get("components", {}), ("propsSchema",)),
        ("behaviors", catalog.get("behaviors", {}), ("propsSchema",)),
        ("operations", catalog.get("operations", {}), ("inputSchema", "outputSchema")),
        ("resources", catalog.get("resources", {}), ("inputSchema", "outputSchema")),
    ]
    for group_name, group, fields in groups:
        for capability_id, capability in group.items():
            for field in fields:
                schema = capability.get(field)
                if not isinstance(schema, dict):
                    continue
                try:
                    Draft202012Validator.check_schema(schema)
                except SchemaError as error:
                    diagnostics.append(
                        Diagnostic(
                            code="SCHEMA_INVALID",
                            path=pointer([group_name, capability_id, field, *error.absolute_path]),
                            message=error.message,
                            category="schema_error",
                        )
                    )
            for slot_name, slot in capability.get("slots", {}).items():
                max_items = slot.get("maxItems")
                min_items = slot.get("minItems", 0)
                if isinstance(max_items, int) and max_items < min_items:
                    diagnostics.append(
                        Diagnostic(
                            code="SCHEMA_INVALID",
                            path=pointer([group_name, capability_id, "slots", slot_name]),
                            message="maxItems is smaller than minItems",
                            category="schema_error",
                        )
                    )
    return diagnostics


def catalog_index(catalogs: list[dict[str, Any]]) -> tuple[dict[str, tuple[str, dict[str, Any]]], list[Diagnostic]]:
    index: dict[str, tuple[str, dict[str, Any]]] = {}
    diagnostics: list[Diagnostic] = []
    for catalog in catalogs:
        for kind in ("components", "behaviors", "operations", "resources"):
            for capability_id, capability in catalog.get(kind, {}).items():
                if capability_id in index:
                    diagnostics.append(
                        Diagnostic(
                            code="AMBIGUOUS_CAPABILITY",
                            path=pointer([kind, capability_id]),
                            message=f"{capability_id!r} is declared more than once in the resolved catalog set",
                            category="catalog_error",
                        )
                    )
                else:
                    index[capability_id] = (kind, capability)
    return index, diagnostics


def contains_dynamic(value: Any) -> bool:
    if isinstance(value, dict):
        if any(key in value for key in ("$ref", "$token", "$format")):
            return True
        return any(contains_dynamic(child) for child in value.values())
    if isinstance(value, list):
        return any(contains_dynamic(child) for child in value)
    return False


def validate_static_object(value: dict[str, Any], schema: dict[str, Any], path_parts: list[Any]) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    properties = schema.get("properties", {}) if isinstance(schema, dict) else {}
    additional = schema.get("additionalProperties", True) if isinstance(schema, dict) else True

    for key, child in value.items():
        if key not in properties and additional is False:
            diagnostics.append(
                Diagnostic(
                    code="UNKNOWN_PROP",
                    path=pointer([*path_parts, key]),
                    message=f"Property {key!r} is not declared by the capability",
                    category="catalog_error",
                )
            )
            continue
        child_schema = properties.get(key)
        if child_schema is not None and not contains_dynamic(child):
            errors = sorted(Draft202012Validator(child_schema).iter_errors(child), key=lambda e: list(e.absolute_path))
            for error in errors:
                diagnostics.append(
                    Diagnostic(
                        code="PROP_TYPE_MISMATCH",
                        path=pointer([*path_parts, key, *error.absolute_path]),
                        message=error.message,
                        category="catalog_error",
                    )
                )
    return diagnostics


def iter_refs(value: Any, path_parts: list[Any] | None = None) -> Iterator[tuple[str, list[Any]]]:
    path_parts = [] if path_parts is None else path_parts
    if isinstance(value, dict):
        if isinstance(value.get("$ref"), str):
            yield value["$ref"], path_parts
        for key, child in value.items():
            yield from iter_refs(child, [*path_parts, key])
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from iter_refs(child, [*path_parts, index])


def validate_catalog_semantics(catalog: dict[str, Any]) -> list[Diagnostic]:
    diagnostics = embedded_schema_diagnostics(catalog)
    index, duplicate = catalog_index([catalog])
    diagnostics.extend(duplicate)
    for kind in ("components", "behaviors", "operations", "resources"):
        for capability_id, capability in catalog.get(kind, {}).items():
            replacement = capability.get("replacement")
            if replacement and replacement not in index:
                diagnostics.append(
                    Diagnostic(
                        code="UNKNOWN_CAPABILITY",
                        path=pointer([kind, capability_id, "replacement"]),
                        message=f"Replacement capability {replacement!r} is not in this catalog",
                        category="catalog_error",
                    )
                )
    return diagnostics


def validate_document_semantics(
    document: dict[str, Any],
    target: str,
    catalogs: list[dict[str, Any]],
) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    index, index_diagnostics = catalog_index(catalogs)
    diagnostics.extend(index_diagnostics)

    surfaces = document.get("surfaces", {})
    entry = document.get("entry")
    if entry not in surfaces:
        diagnostics.append(
            Diagnostic("ENTRY_NOT_FOUND", "/entry", f"Entry surface {entry!r} does not exist", "semantic_error")
        )

    all_surface_ids = set(surfaces)

    for surface_key, surface in surfaces.items():
        surface_path = ["surfaces", surface_key]
        if surface.get("id") != surface_key:
            diagnostics.append(
                Diagnostic(
                    "DUPLICATE_SURFACE_ID",
                    pointer([*surface_path, "id"]),
                    "Surface map key and internal id must be equal",
                    "semantic_error",
                )
            )

        state = surface.get("state", {})
        resources = surface.get("resources", {})
        for state_name, state_spec in state.items():
            schema = state_spec.get("schema", {})
            try:
                Draft202012Validator.check_schema(schema)
                errors = list(Draft202012Validator(schema).iter_errors(state_spec.get("initial")))
            except SchemaError as error:
                errors = [error]
            for error in errors:
                diagnostics.append(
                    Diagnostic(
                        "SCHEMA_INVALID",
                        pointer([*surface_path, "state", state_name, "initial", *getattr(error, "absolute_path", [])]),
                        error.message,
                        "schema_error",
                    )
                )

        for resource_name, instance in resources.items():
            capability_id = instance.get("use")
            resolved = index.get(capability_id)
            if not resolved or resolved[0] != "resources":
                diagnostics.append(
                    Diagnostic(
                        "UNKNOWN_CAPABILITY",
                        pointer([*surface_path, "resources", resource_name, "use"]),
                        f"Resource capability {capability_id!r} is not declared",
                        "catalog_error",
                    )
                )
                continue
            capability = resolved[1]
            policy = instance.get("policy")
            if policy not in capability.get("policies", []):
                diagnostics.append(
                    Diagnostic(
                        "RESOURCE_INPUT_INVALID",
                        pointer([*surface_path, "resources", resource_name, "policy"]),
                        f"Policy {policy!r} is not supported by {capability_id}",
                        "catalog_error",
                    )
                )
            if not contains_dynamic(instance.get("input", {})):
                for error in Draft202012Validator(capability.get("inputSchema", {})).iter_errors(instance.get("input", {})):
                    diagnostics.append(
                        Diagnostic(
                            "RESOURCE_INPUT_INVALID",
                            pointer([*surface_path, "resources", resource_name, "input", *error.absolute_path]),
                            error.message,
                            "catalog_error",
                        )
                    )

        nodes: dict[str, tuple[str, dict[str, Any], dict[str, Any], list[Any], set[str]]] = {}
        pending_actions: list[tuple[dict[str, Any], list[Any], set[str]]] = []
        operation_aliases: set[str] = set()

        def validate_refs(value: Any, base_path: list[Any], repeat_aliases: set[str]) -> None:
            for reference, relative_path in iter_refs(value):
                parts = reference.split(".")
                namespace = parts[0]
                if namespace == "state" and (len(parts) < 2 or parts[1] not in state):
                    diagnostics.append(Diagnostic("REFERENCE_UNRESOLVED", pointer([*base_path, *relative_path]), f"Unknown state reference {reference!r}", "semantic_error"))
                elif namespace == "resource" and (len(parts) < 2 or parts[1] not in resources):
                    diagnostics.append(Diagnostic("REFERENCE_UNRESOLVED", pointer([*base_path, *relative_path]), f"Unknown resource reference {reference!r}", "semantic_error"))
                elif namespace == "item" and (len(parts) < 2 or parts[1] not in repeat_aliases):
                    diagnostics.append(Diagnostic("REFERENCE_UNRESOLVED", pointer([*base_path, *relative_path]), f"Unknown repeat alias in {reference!r}", "semantic_error"))

        def validate_style(style: dict[str, Any], capability: dict[str, Any], base_path: list[Any]) -> None:
            visual_states = {"base", *capability.get("visualStates", [])}
            style_parts = capability.get("styleParts", {})
            for state_name, parts in style.items():
                if state_name not in visual_states:
                    diagnostics.append(Diagnostic("UNKNOWN_PROP", pointer([*base_path, state_name]), f"Unknown visual state {state_name!r}", "catalog_error"))
                for part_name, values in parts.items():
                    if part_name not in style_parts:
                        diagnostics.append(Diagnostic("UNKNOWN_PROP", pointer([*base_path, state_name, part_name]), f"Unknown style part {part_name!r}", "catalog_error"))
                        continue
                    diagnostics.extend(validate_static_object(values, style_parts[part_name].get("propertiesSchema", {}), [*base_path, state_name, part_name]))

        def validate_actions(actions: list[dict[str, Any]], base_path: list[Any], repeat_aliases: set[str]) -> None:
            for action_index, action in enumerate(actions):
                action_path = [*base_path, action_index]
                action_type = action.get("type")
                validate_refs(action, action_path, repeat_aliases)
                if action_type in {"state.set", "state.toggle"}:
                    state_name = str(action.get("path", "")).split(".")[0]
                    if state_name not in state:
                        diagnostics.append(Diagnostic("STATE_WRITE_INVALID", pointer([*action_path, "path"]), f"Unknown state {state_name!r}", "semantic_error"))
                elif action_type == "navigate":
                    if action.get("surface") not in all_surface_ids:
                        diagnostics.append(Diagnostic("ENTRY_NOT_FOUND", pointer([*action_path, "surface"]), f"Navigation target {action.get('surface')!r} does not exist", "semantic_error"))
                elif action_type == "operation.invoke":
                    capability_id = action.get("operation")
                    resolved = index.get(capability_id)
                    if not resolved or resolved[0] != "operations":
                        diagnostics.append(Diagnostic("UNKNOWN_CAPABILITY", pointer([*action_path, "operation"]), f"Operation {capability_id!r} is not declared", "catalog_error"))
                    else:
                        if not contains_dynamic(action.get("input", {})):
                            for error in Draft202012Validator(resolved[1].get("inputSchema", {})).iter_errors(action.get("input", {})):
                                diagnostics.append(Diagnostic("OPERATION_INPUT_INVALID", pointer([*action_path, "input", *error.absolute_path]), error.message, "catalog_error"))
                    alias = action.get("as")
                    if isinstance(alias, str):
                        operation_aliases.add(alias)
                    validate_actions(action.get("onSuccess", []), [*action_path, "onSuccess"], repeat_aliases)
                    validate_actions(action.get("onFailure", []), [*action_path, "onFailure"], repeat_aliases)
                elif action_type == "resource.refresh":
                    if action.get("resource") not in resources:
                        diagnostics.append(Diagnostic("REFERENCE_UNRESOLVED", pointer([*action_path, "resource"]), f"Unknown resource instance {action.get('resource')!r}", "semantic_error"))
                elif action_type == "component.command":
                    pending_actions.append((action, action_path, set(repeat_aliases)))

        def walk_node(node: dict[str, Any], node_path: list[Any], repeat_aliases: set[str]) -> None:
            node_id = node.get("id")
            capability_id = node.get("use")
            if node_id in nodes:
                diagnostics.append(Diagnostic("DUPLICATE_NODE_ID", pointer([*node_path, "id"]), f"Node or behavior id {node_id!r} is duplicated", "semantic_error"))
            resolved = index.get(capability_id)
            if not resolved or resolved[0] != "components":
                diagnostics.append(Diagnostic("UNKNOWN_CAPABILITY", pointer([*node_path, "use"]), f"Component capability {capability_id!r} is not declared", "catalog_error"))
                capability: dict[str, Any] = {}
            else:
                capability = resolved[1]
            local_aliases = set(repeat_aliases)
            repeat = node.get("repeat")
            if repeat:
                alias = repeat.get("as")
                if alias in local_aliases:
                    diagnostics.append(Diagnostic("REPEAT_KEY_INVALID", pointer([*node_path, "repeat", "as"]), f"Repeat alias {alias!r} shadows an active alias", "semantic_error"))
                elif isinstance(alias, str):
                    local_aliases.add(alias)
                validate_refs(repeat, [*node_path, "repeat"], local_aliases)

            nodes[node_id] = (capability_id, capability, node, node_path, set(local_aliases))

            props = node.get("props", {})
            validate_refs(props, [*node_path, "props"], local_aliases)
            if capability:
                diagnostics.extend(validate_static_object(props, capability.get("propsSchema", {}), [*node_path, "props"]))
                validate_style(node.get("style", {}), capability, [*node_path, "style"])

            for event_name, actions in node.get("on", {}).items():
                if capability and event_name not in capability.get("events", {}):
                    diagnostics.append(Diagnostic("UNKNOWN_EVENT", pointer([*node_path, "on", event_name]), f"Event {event_name!r} is not declared by {capability_id}", "catalog_error"))
                validate_actions(actions, [*node_path, "on", event_name], local_aliases)

            for behavior_index, behavior in enumerate(node.get("behaviors", [])):
                behavior_path = [*node_path, "behaviors", behavior_index]
                behavior_id = behavior.get("id")
                if behavior_id in nodes:
                    diagnostics.append(Diagnostic("DUPLICATE_NODE_ID", pointer([*behavior_path, "id"]), f"Node or behavior id {behavior_id!r} is duplicated", "semantic_error"))
                behavior_use = behavior.get("use")
                behavior_resolved = index.get(behavior_use)
                if not behavior_resolved or behavior_resolved[0] != "behaviors":
                    diagnostics.append(Diagnostic("UNKNOWN_CAPABILITY", pointer([*behavior_path, "use"]), f"Behavior capability {behavior_use!r} is not declared", "catalog_error"))
                    behavior_capability: dict[str, Any] = {}
                else:
                    behavior_capability = behavior_resolved[1]
                    attach = behavior_capability.get("attachTo", {})
                    allowed_caps = set(attach.get("capabilities", []))
                    allowed_categories = set(attach.get("categories", []))
                    component_category = capability.get("category") if capability else None
                    if capability_id not in allowed_caps and component_category not in allowed_categories:
                        diagnostics.append(Diagnostic("BEHAVIOR_ATTACHMENT_INVALID", pointer([*behavior_path, "use"]), f"{behavior_use} cannot attach to {capability_id}", "catalog_error"))
                nodes[behavior_id] = (behavior_use, behavior_capability, behavior, behavior_path, set(local_aliases))
                if behavior_capability:
                    diagnostics.extend(validate_static_object(behavior.get("props", {}), behavior_capability.get("propsSchema", {}), [*behavior_path, "props"]))
                    validate_style(behavior.get("style", {}), behavior_capability, [*behavior_path, "style"])
                validate_refs(behavior, behavior_path, local_aliases)
                for event_name, actions in behavior.get("on", {}).items():
                    if behavior_capability and event_name not in behavior_capability.get("events", {}):
                        diagnostics.append(Diagnostic("UNKNOWN_EVENT", pointer([*behavior_path, "on", event_name]), f"Event {event_name!r} is not declared by {behavior_use}", "catalog_error"))
                    validate_actions(actions, [*behavior_path, "on", event_name], local_aliases)
                for slot_name, children in behavior.get("slots", {}).items():
                    for child_index, child in enumerate(children):
                        walk_node(child, [*behavior_path, "slots", slot_name, child_index], local_aliases)

            for variant_index, variant in enumerate(node.get("variants", [])):
                validate_refs(variant, [*node_path, "variants", variant_index], local_aliases)
                if capability:
                    diagnostics.extend(validate_static_object(variant.get("props", {}), capability.get("propsSchema", {}), [*node_path, "variants", variant_index, "props"]))
                    validate_style(variant.get("style", {}), capability, [*node_path, "variants", variant_index, "style"])

            for slot_name, children in node.get("slots", {}).items():
                slot_contract = capability.get("slots", {}).get(slot_name) if capability else None
                if capability and slot_contract is None:
                    diagnostics.append(Diagnostic("UNKNOWN_SLOT", pointer([*node_path, "slots", slot_name]), f"Slot {slot_name!r} is not declared by {capability_id}", "catalog_error"))
                elif slot_contract:
                    min_items = slot_contract.get("minItems", 1 if slot_contract.get("required") else 0)
                    max_items = slot_contract.get("maxItems")
                    if len(children) < min_items or (isinstance(max_items, int) and len(children) > max_items):
                        diagnostics.append(Diagnostic("SLOT_CARDINALITY", pointer([*node_path, "slots", slot_name]), f"Slot has {len(children)} children; expected {min_items}..{max_items if max_items is not None else '∞'}", "catalog_error"))
                    accepts = set(slot_contract.get("accepts", []))
                    categories = set(slot_contract.get("acceptsCategories", []))
                    for child_index, child in enumerate(children):
                        child_resolved = index.get(child.get("use"))
                        child_category = child_resolved[1].get("category") if child_resolved and child_resolved[0] == "components" else None
                        if (accepts or categories) and child.get("use") not in accepts and child_category not in categories:
                            diagnostics.append(Diagnostic("SLOT_CHILD_REJECTED", pointer([*node_path, "slots", slot_name, child_index, "use"]), f"{child.get('use')!r} is not accepted by slot {slot_name!r}", "catalog_error"))
                for child_index, child in enumerate(children):
                    walk_node(child, [*node_path, "slots", slot_name, child_index], local_aliases)

        root = surface.get("root")
        if isinstance(root, dict):
            walk_node(root, [*surface_path, "root"], set())

        for action, action_path, repeat_aliases in pending_actions:
            target_id = action.get("target")
            target = nodes.get(target_id)
            if not target:
                diagnostics.append(Diagnostic("UNKNOWN_COMMAND", pointer([*action_path, "target"]), f"Command target {target_id!r} does not exist", "catalog_error"))
                continue
            capability_id, capability, _, _, _ = target
            command_name = action.get("command")
            command = capability.get("commands", {}).get(command_name)
            if not command:
                diagnostics.append(Diagnostic("UNKNOWN_COMMAND", pointer([*action_path, "command"]), f"Command {command_name!r} is not declared by {capability_id}", "catalog_error"))
            elif not contains_dynamic(action.get("input", {})):
                for error in Draft202012Validator(command.get("inputSchema", {})).iter_errors(action.get("input", {})):
                    diagnostics.append(Diagnostic("COMMAND_INPUT_INVALID", pointer([*action_path, "input", *error.absolute_path]), error.message, "catalog_error"))

        # Validate operation lifecycle references after all aliases have been discovered.
        for reference, ref_path in iter_refs(surface):
            parts = reference.split(".")
            if parts[0] == "operation" and (len(parts) < 2 or parts[1] not in operation_aliases):
                diagnostics.append(Diagnostic("REFERENCE_UNRESOLVED", pointer([*surface_path, *ref_path]), f"Unknown operation alias in {reference!r}", "semantic_error"))

    if target == "bundle":
        required = document.get("requires", {}).get("catalogs", [])
        catalogs_by_key = {(catalog.get("id"), catalog.get("version"), catalog.get("target")): catalog for catalog in catalogs}
        for index_number, requirement in enumerate(required):
            key = (requirement.get("id"), requirement.get("version"), requirement.get("target"))
            catalog = catalogs_by_key.get(key)
            if not catalog:
                diagnostics.append(Diagnostic("CATALOG_VERSION_UNAVAILABLE", pointer(["requires", "catalogs", index_number]), f"Exact catalog package {key!r} is unavailable", "activation_error"))
            elif requirement.get("digest") != catalog.get("packageDigest"):
                diagnostics.append(Diagnostic("CATALOG_DIGEST_MISMATCH", pointer(["requires", "catalogs", index_number, "digest"]), f"Required {requirement.get('digest')}, installed {catalog.get('packageDigest')}", "activation_error"))

    return diagnostics


def validate_file(path: Path, target: str, catalog_paths: list[Path]) -> list[Diagnostic]:
    try:
        document = load_json(path)
    except (OSError, json.JSONDecodeError) as error:
        return [Diagnostic("SCHEMA_INVALID", "", str(error), "schema_error")]

    diagnostics = schema_diagnostics(document, target)
    if diagnostics:
        return diagnostics

    if target == "catalog":
        return validate_catalog_semantics(document)

    catalogs: list[dict[str, Any]] = []
    for catalog_path in catalog_paths:
        catalog = load_json(catalog_path)
        catalog_errors = schema_diagnostics(catalog, "catalog")
        if catalog_errors:
            return catalog_errors
        catalogs.append(catalog)
    if not catalogs:
        return [Diagnostic("CATALOG_VERSION_UNAVAILABLE", "", "At least one catalog is required for semantic validation", "activation_error")]
    diagnostics = validate_document_semantics(document, target, catalogs)
    if target == "bundle":
        expected_revision = node_digest("bundle", path)
        if document.get("revision") != expected_revision:
            diagnostics.append(Diagnostic("REVISION_MISMATCH", "/revision", f"Expected {expected_revision}", "integrity_error"))
    return diagnostics


def run_suite() -> int:
    diagnostics = check_schemas()
    if diagnostics:
        for diagnostic in diagnostics:
            print(f"FAIL schema: {diagnostic}")
        return 1

    vector_path = ROOT / "conformance" / "vectors.json"
    manifest = load_json(vector_path)
    default_catalog = ROOT / "conformance" / manifest["catalog"]
    passed = 0
    failed = 0

    for vector in manifest["vectors"]:
        path = ROOT / "conformance" / vector["file"]
        target = vector["target"]
        result = validate_file(path, target, [default_catalog] if target != "catalog" else [])
        expected = vector["expect"]
        expected_code = vector.get("code")

        if expected == "valid":
            ok = not result
        else:
            ok = any(d.code == expected_code and d.category == expected for d in result)

        if ok:
            passed += 1
            print(f"PASS {vector['file']} ({expected}{'/' + expected_code if expected_code else ''})")
        else:
            failed += 1
            print(f"FAIL {vector['file']} expected {expected}/{expected_code or '-'}")
            if not result:
                print("  received: valid")
            for diagnostic in result:
                print(f"  received: {diagnostic.category}/{diagnostic}")

    # Validate all public examples as an additional package health check.
    example_catalog = ROOT / "examples" / "catalog.web.example.json"
    examples = [
        (ROOT / "examples" / "catalog.web.example.json", "catalog", []),
        (ROOT / "examples" / "sign-in.source.desen.json", "source", [example_catalog]),
        (ROOT / "examples" / "sign-in.bundle.desen.json", "bundle", [example_catalog]),
        (ROOT / "examples" / "store-map.source.desen.json", "source", [example_catalog]),
        (ROOT / "examples" / "sortable-list.source.desen.json", "source", [example_catalog]),
    ]
    for path, target, catalogs in examples:
        result = validate_file(path, target, catalogs)
        if result:
            failed += 1
            print(f"FAIL example {path.name}")
            for diagnostic in result:
                print(f"  {diagnostic.category}/{diagnostic}")
        else:
            passed += 1
            print(f"PASS example {path.name}")

    print(f"\n{passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


def infer_target(document: Any) -> str | None:
    kind = document.get("kind") if isinstance(document, dict) else None
    return {
        "desen.source": "source",
        "desen.bundle": "bundle",
        "desen.catalog": "catalog",
    }.get(kind)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate DESEN 0.1.0 documents")
    parser.add_argument("file", nargs="?", type=Path, help="JSON document to validate")
    parser.add_argument("--target", choices=sorted(SCHEMAS), help="Document type; inferred from kind when omitted")
    parser.add_argument("--catalog", action="append", type=Path, default=[], help="Catalog used for source/bundle semantic validation; repeatable")
    parser.add_argument("--suite", action="store_true", help="Run the bundled conformance suite and examples")
    args = parser.parse_args()

    if args.suite:
        return run_suite()
    if not args.file:
        parser.error("provide a file or use --suite")

    try:
        document = load_json(args.file)
    except (OSError, json.JSONDecodeError) as error:
        print(error, file=sys.stderr)
        return 2
    target = args.target or infer_target(document)
    if not target:
        print("Cannot infer target from document kind; use --target", file=sys.stderr)
        return 2

    result = validate_file(args.file, target, args.catalog)
    if result:
        for diagnostic in result:
            print(f"{diagnostic.category}/{diagnostic}")
        return 1
    print(f"VALID {target}: {args.file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
