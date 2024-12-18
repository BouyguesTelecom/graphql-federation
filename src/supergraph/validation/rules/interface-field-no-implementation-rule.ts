import { GraphQLError } from 'graphql';
import { SupergraphVisitorMap } from '../../composition/visitor.js';
import { SupergraphState } from '../../state.js';
import { SupergraphValidationContext } from '../validation-context.js';
import { ObjectTypeFieldState } from '../../composition/object-type.js';

export function InterfaceFieldNoImplementationRule(
  context: SupergraphValidationContext,
  supergraph: SupergraphState,
): SupergraphVisitorMap {
  return {
    ObjectType(objectTypeState) {
      if (objectTypeState.interfaces.size === 0) {
        return;
      }

      for (const interfaceName of objectTypeState.interfaces) {
        const interfaceTypeState = getTypeFromSupergraph(supergraph, interfaceName);

        if (!interfaceTypeState) {
          throw new Error(`Expected an interface to exist in supergraph state`);
        }

        if (interfaceTypeState.kind !== 'interface') {
          // Covered by TYPE_KIND_MISMATCH rule
          return;
        }

        const nonRequiredFields: string[] = [];

        for (const [graph, interfaceStateInGraph] of interfaceTypeState.byGraph) {
          if (!interfaceStateInGraph.isInterfaceObject) {
            continue;
          }

          for (const [fieldName, interfaceFieldState] of interfaceTypeState.fields) {
            const interfaceFieldStateInGraph = interfaceFieldState.byGraph.get(graph);
            if (!interfaceFieldStateInGraph) {
              continue;
            }

            if (interfaceFieldStateInGraph.external) {
              continue;
            }

            nonRequiredFields.push(fieldName);
          }
        }

        for (const [fieldName, interfaceFieldState] of interfaceTypeState.fields) {
          // skip fields that are defined in interface objects or in interface entities
          if (nonRequiredFields.includes(fieldName)) {
            continue;
          }

          // TODO: detect if a field is missing in a non-entity object type definition
          if (objectTypeState.fields.has(fieldName) && objectTypeState.isEntity) {
            continue;
          }

          for (const [graph, objectTypeInGraph] of objectTypeState.byGraph) {
            // check if object in the graph, implements an interface of the same name
            if (!objectTypeInGraph.interfaces.has(interfaceName)) {
              // if not, continue
              continue;
            }

            const objectFieldState = objectTypeState.fields.get(fieldName);

            // if not, make sure it implements the field
            // if (!objectFieldState?.byGraph.has(graph)) {
            // FIXME: instead of throwing an error, add the missing fields to the object
            if (!objectFieldState) {
              const objectTypeStateFields = supergraph.objectTypes.get(objectTypeState.name)?.fields;
              const interfaceTypeFields = supergraph.interfaceTypes.get(interfaceName)?.fields;
              if (objectTypeStateFields && interfaceTypeFields) {
                const mergedFields = new Map<string, ObjectTypeFieldState>([
                  ...Array.from(objectTypeStateFields.entries()),
                  ...Array.from(interfaceTypeFields.entries()).map<[string, ObjectTypeFieldState]>(([key, interfaceField]) => [
                    key,
                    interfaceField as unknown as ObjectTypeFieldState
                  ])
                ]);
                supergraph.objectTypes.get(objectTypeState.name)!.fields = mergedFields;
              }
            }
          }
        }
      }
    },
  };
}

function getTypeFromSupergraph(state: SupergraphState, name: string) {
  return (
    state.objectTypes.get(name) ?? state.interfaceTypes.get(name) ?? state.unionTypes.get(name)
  );
}
