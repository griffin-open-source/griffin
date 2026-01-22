# PlanPostRequestNodesInner


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** |  | [default to undefined]
**type** | **string** |  | [default to undefined]
**method** | **string** |  | [default to undefined]
**path** | [**PlanPostRequestNodesInnerAnyOfPath**](PlanPostRequestNodesInnerAnyOfPath.md) |  | [default to undefined]
**base** | [**PlanPostRequestNodesInnerAnyOfPath**](PlanPostRequestNodesInnerAnyOfPath.md) |  | [default to undefined]
**headers** | [**{ [key: string]: PlanPostRequestNodesInnerAnyOfHeadersValue; }**](PlanPostRequestNodesInnerAnyOfHeadersValue.md) |  | [optional] [default to undefined]
**body** | **any** |  | [optional] [default to undefined]
**response_format** | **string** |  | [default to undefined]
**duration_ms** | **number** |  | [default to undefined]
**assertions** | [**Array&lt;PlanPostRequestNodesInnerAnyOf2AssertionsInner&gt;**](PlanPostRequestNodesInnerAnyOf2AssertionsInner.md) |  | [default to undefined]

## Example

```typescript
import { PlanPostRequestNodesInner } from 'griffin-hub-sdk';

const instance: PlanPostRequestNodesInner = {
    id,
    type,
    method,
    path,
    base,
    headers,
    body,
    response_format,
    duration_ms,
    assertions,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
