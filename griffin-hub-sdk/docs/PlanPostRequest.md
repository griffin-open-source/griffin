# PlanPostRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**project** | **string** |  | [default to undefined]
**locations** | **Array&lt;string&gt;** |  | [optional] [default to undefined]
**name** | **string** |  | [default to undefined]
**version** | **string** |  | [default to undefined]
**frequency** | [**PlanPostRequestFrequency**](PlanPostRequestFrequency.md) |  | [default to undefined]
**environment** | **string** |  | [default to 'default']
**nodes** | [**Array&lt;PlanPostRequestNodesInner&gt;**](PlanPostRequestNodesInner.md) |  | [default to undefined]
**edges** | [**Array&lt;PlanPostRequestEdgesInner&gt;**](PlanPostRequestEdgesInner.md) |  | [default to undefined]

## Example

```typescript
import { PlanPostRequest } from 'griffin-hub-sdk';

const instance: PlanPostRequest = {
    project,
    locations,
    name,
    version,
    frequency,
    environment,
    nodes,
    edges,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
