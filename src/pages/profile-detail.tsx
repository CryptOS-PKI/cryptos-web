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

import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { ProfileForm } from "@/components/profile-form";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import { deleteProfile, useProfiles } from "@/lib/profiles";

export const ProfileDetailPage = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { operator } = useAuth();
  const isAdmin = operator?.level === "admin";

  const profiles = useProfiles();
  const profile = name ? profiles.find((p) => p.name === name) : undefined;

  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (!profile) {
    return <Navigate replace to="/profiles" />;
  }

  const remove = async () => {
    setError("");
    setPending(true);
    try {
      const res = await deleteProfile(profile.name);
      if (!res.ok) {
        setError(res.reason ?? "Could not delete profile.");
        return;
      }
      navigate("/profiles");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
        <p className="font-mono text-sm text-muted-foreground">Certificate profile</p>
      </div>
      <ProfileForm initial={profile} mode="edit" onDone={() => navigate("/profiles")} />

      {isAdmin ? (
        <div className="max-w-lg space-y-2 rounded-md border border-destructive/40 p-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Danger zone
          </p>
          {error ? (
            <p className="font-mono text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                Delete this catalog profile? Node copies are untouched.
              </span>
              <Button
                disabled={pending}
                onClick={() => void remove()}
                type="button"
                variant="destructive"
              >
                {pending ? "Deleting…" : "Confirm delete"}
              </Button>
              <Button onClick={() => setConfirming(false)} type="button" variant="outline">
                Cancel
              </Button>
            </div>
          ) : (
            <Button onClick={() => setConfirming(true)} type="button" variant="destructive">
              Delete profile
            </Button>
          )}
        </div>
      ) : null}

      <Button asChild variant="outline">
        <Link to="/profiles">Back to profiles</Link>
      </Button>
    </section>
  );
};
