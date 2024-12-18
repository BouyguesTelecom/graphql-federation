import { GraphQLError } from 'graphql';
import { SupergraphVisitorMap } from '../../composition/visitor.js';
import { SupergraphValidationContext } from '../validation-context.js';

export function InputObjectValuesRule(context: SupergraphValidationContext): SupergraphVisitorMap {
  return {
    InputObjectType(inputObjectTypeState) {
      const fieldsInCommon: string[] = [];
      const total = inputObjectTypeState.byGraph.size;
      for (const [fieldName, fieldState] of inputObjectTypeState.fields) {
        // If it's not used in all the subgraphs, it's missing in some of them
        if (fieldState.byGraph.size === total) {
          fieldsInCommon.push(fieldName);
        }
      }
      if (fieldsInCommon.length === 0) {
        let baseValue;
        for (const [fieldKey, fieldValue] of inputObjectTypeState.fields) {
          baseValue = fieldValue.byGraph.values().next().value;
          if (baseValue) {
            for (const [graphKey, _] of inputObjectTypeState.byGraph) {
              inputObjectTypeState.fields.get(fieldKey)?.byGraph.set(graphKey, baseValue);
            }
          }
        }
      }
    },
  };
}
