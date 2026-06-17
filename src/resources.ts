import { crudResource } from "./commands/crud.ts"
import { propertyformatsResource } from "./commands/propertyformats.ts"
import { manifestResource } from "./commands/manifest.ts"
import { contentResource } from "./commands/content.ts"
import type { ResourceSpec } from "./registry.ts"

/**
 * The registry of all resources the CLI exposes. Phase 1 covers the 8 standard
 * CRUD domains via the shared factory. propertyformats, manifest and content
 * (Phases 2-3) will be appended here as bespoke specs.
 */
export const resources: ResourceSpec[] = [
   contentResource,
   crudResource({ name: "applications", description: "Websites/frontends running on the CMS instance", accessor: (sdk) => sdk.applications }),
   crudResource({ name: "blueprints", description: "Reusable Visual Builder layout templates", accessor: (sdk) => sdk.blueprints }),
   crudResource({ name: "contenttypes", description: "Structured definitions for kinds of content", accessor: (sdk) => sdk.contenttypes }),
   crudResource({ name: "sources", description: "Registered external content sources", accessor: (sdk) => sdk.sources }),
   crudResource({ name: "bindings", description: "Content type property bindings", accessor: (sdk) => sdk.bindings }),
   crudResource({ name: "displaytemplates", description: "Components defining how content is rendered", accessor: (sdk) => sdk.displaytemplates }),
   crudResource({ name: "locales", description: "Languages enabled for content authoring", accessor: (sdk) => sdk.locales }),
   crudResource({ name: "propertygroups", description: "Property tabs in the editing interface", accessor: (sdk) => sdk.propertygroups }),
   propertyformatsResource,
   manifestResource,
]
