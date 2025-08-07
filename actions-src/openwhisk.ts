import openwhisk from "openwhisk";

export async function invokeAction(action: string, data: unknown): Promise<any> {
  const openwhiskClient = openwhisk();

  return await openwhiskClient.actions.invoke({
    name: action,
    blocking: false,
    result: false,
    params: {
      data,
    },
  });
}
