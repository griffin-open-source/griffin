# TestPlanV1


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**project** | **string** |  | [default to undefined]
**locations** | **Array&lt;string&gt;** |  | [optional] [default to undefined]
**id** | **string** |  | [default to undefined]
**name** | **string** |  | [default to undefined]
**version** | **string** |  | [default to undefined]
**frequency** | [**Frequency1**](Frequency1.md) |  | [default to undefined]
**environment** | **string** |  | [default to 'default']
**nodes** | [**Array&lt;Node&gt;**](Node.md) |  | [default to undefined]
**edges** | [**Array&lt;Edge&gt;**](Edge.md) |  | [default to undefined]

## Example

```typescript
import { TestPlanV1 } from 'griffin-hub-sdk';

const instance: TestPlanV1 = {
    project,
    locations,
    id,
    name,
    version,
    frequency,
    environment,
    nodes,
    edges,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
