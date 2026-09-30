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

import { Link, useNavigate } from "react-router-dom";

import { ProfileForm } from "@/components/profile-form";
import { Button } from "@/components/ui/button";

export const ProfileNewPage = () => {
  const navigate = useNavigate();

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">New profile</h1>
        <p className="font-mono text-sm text-muted-foreground">Define a certificate template</p>
      </div>
      <ProfileForm mode="create" onDone={(name) => navigate(`/profiles/${name}`)} />
      <Button asChild variant="outline">
        <Link to="/profiles">Back to profiles</Link>
      </Button>
    </section>
  );
};
