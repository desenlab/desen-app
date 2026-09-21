# DESEN App developer integration guide

This guide describes the explicit host binding used by the authoring Connections workspace. It is
deliberately a composition-root API: executable adapters are installed by trusted application code
and never selected, serialized, or edited by a DESEN Source document.

## What is installed

An integration binds only Catalog-declared operation and resource capability IDs to host-owned
callbacks. The App checks the exact workspace profile and authenticated Catalog before retaining a
binding. A design document can select a capability and map schema-compatible values, but it cannot
provide an endpoint, credential, package name, fetch callback, loader, or arbitrary code.

```ts
const binding = createAuthoringIntegrationBinding({
  profile,
  bindingId: "local-deliveries",
  label: "Delivery service",
  description: "Explicit local delivery integration.",
  operations: [
    {
      capabilityId: "com.example.deliveries/dispatch",
      effect: "external",
      invoke: (request, signal) => deliveryHost.dispatch(request.input, signal),
    },
  ],
  resources: [
    {
      capabilityId: "com.example.deliveries/records",
      load: (request, signal) => deliveryHost.read(request.input, signal),
    },
  ],
});
```

The callbacks return only a Runtime candidate envelope (`succeeded`, `failed`, or `denied`). Runtime
still owns input/output schema validation, public error validation, lifecycle policy, and stale
settlement handling. Host exceptions are sanitized at the App boundary; secrets and raw failures are
not placed in Source or UI snapshots.

## Installation and lifecycle

1. Resolve the workspace profile and Catalog set through the App's trusted composition root.
2. Create one binding with exact capability IDs from that Catalog. Duplicate, undeclared, wrong
   effect, accessor-backed, inherited, or extra-authority records are rejected.
3. Create a controller for the exact admitted document, surface, and preview revision.
4. Keep the controller inactive until the user explicitly chooses Integration in Run. Deactivate it
   on mode/document changes and dispose it permanently when the lifetime closes.
5. Treat the Connections workspace's readiness list as disclosure only. It contains names and
   lifecycle status, never request payloads, fixture values, endpoints, or credentials.

Resource and operation callbacks are separate ports. A resource instance must exist in the selected
Source surface and its input object must satisfy the Catalog schema before the host callback runs.
The resource request is bound to the exact document ID, surface, preview revision, instance ID and
capability ID. Request IDs are single-use within a controller lifetime; deactivation aborts pending
work and denies stale settlements.

## Synthetic versus Integration

Design mode and Synthetic Run use only Catalog-authenticated fixtures and never call these host
callbacks or the network. Integration is a separate, explicit lifetime. Switching documents,
surfaces, revisions, or modes revokes the prior controller synchronously. Production activation,
publication, persistence, and arbitrary package loading are outside this guide and remain separate
plan tasks.

Do not place this binding object in Source, editor metadata, a Catalog manifest, or a URL. Keep
credentials and infrastructure configuration in the host application and pass only bounded public
values through the callback implementation.
