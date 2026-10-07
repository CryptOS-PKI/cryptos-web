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

import * as React from "react";

import { Tooltip } from "../components/tooltip";
import { IconLock } from "../icons";

export type Role = "admin" | "operator" | "viewer";
export const roleRank: Record<Role, number> = { admin: 2, operator: 1, viewer: 0 };

// RoleGate shows an action the signed-in role can't use as locked rather than
// hidden: it stays focusable (so keyboard and screen-reader users learn it
// exists), is marked aria-disabled, ignores activation, and explains the role
// it needs. The server still enforces the permission; this is presentation.
export const RoleGate = ({
  children,
  have,
  need,
}: {
  children: React.ReactElement<Record<string, unknown>>;
  have: Role;
  need: Role;
}) => {
  if (roleRank[have] >= roleRank[need]) return children;
  const block = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const locked = React.cloneElement(children, {
    "aria-disabled": true,
    children: (
      <>
        <IconLock size={16} />
        {children.props.children as React.ReactNode}
      </>
    ),
    onClick: block,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") block(event);
    },
  });
  return <Tooltip content={`Needs the ${need} role`}>{locked}</Tooltip>;
};
