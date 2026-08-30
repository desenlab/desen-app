import { applicationName } from "../desen-app/src/application.js";
import { emptyProjectName } from "../desen-app/src/reference-empty-project.js";
import "../desen-app/src/styles.css";
import { editorCoreName } from "../../packages/editor-core/src/index.js";

export const allowedBrowserProofComposition = Object.freeze({
  applicationName,
  editorCoreName,
  emptyProjectName,
});
