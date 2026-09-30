/*
Apache License 2.0

Copyright 2026 Shane

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

import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export const NotFoundPage = () => {
  return (
    <section className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="font-mono text-4xl font-bold text-primary">404</p>
      <p className="text-sm text-muted-foreground">That page is not part of the Fleet Manager.</p>
      <Button asChild>
        <Link to="/">Back to dashboard</Link>
      </Button>
    </section>
  );
};
