/*
Copyright The CryptOS Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// NODE_LABEL mirrors the manager's nodeLabel regex (RenameNode, #87): an RFC
// 1123 label, 1 to 63 lowercase letters, digits and hyphens, starting and
// ending with a letter or digit.
const NODE_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

// NODE_ID_SHAPE mirrors the manager's store.IsNodeID: a canonical lowercase,
// hyphenated UUID. A name shaped like this is refused too, because a link
// segment of that shape is read as an id.
const NODE_ID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// validateNodeName checks a candidate node name the way RenameNode does,
// before any round trip to the manager. Returns the reason it would be
// refused, or undefined when the name is fine to submit.
export const validateNodeName = (name: string): string | undefined => {
  if (!NODE_LABEL.test(name)) {
    return "Must be 1 to 63 lowercase letters, digits and hyphens, starting and ending with a letter or digit.";
  }
  if (NODE_ID_SHAPE.test(name)) {
    return "That has the form of a node ID, not a name.";
  }
  return undefined;
};
