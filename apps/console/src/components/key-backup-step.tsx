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

import { useEffect, useState } from "react";

import type { OperatorLevel } from "@/lib/operators";

import { Button } from "@/components/ui/button";
import { generateBackupPassphrase, keyBackupFilename, keyBackupPem } from "@/lib/crypto/key-backup";
import { generateLeafKeyAndCSR } from "@/lib/crypto/leaf-key";
import { downloadText } from "@/lib/download";

export interface BackedUpKey {
  // backup is the encrypted key backup file, exactly as downloaded.
  backup: Uint8Array;
  csrDer: Uint8Array;
}

interface Made {
  backupPem: string;
  csrDer: Uint8Array;
  passphrase: string;
}

// KeyBackupStep makes a P-384 key and a CSR (CN=<email>, asking for the level's
// profile) in the browser, then makes the operator save an encrypted key
// backup before anything else happens. The passphrase is generated here and
// shown only while this step is mounted; nothing stores it. The private key
// itself is dropped once the backup is written: later steps open the backup.
export const KeyBackupStep = ({
  email,
  level,
  onBackedUp,
}: {
  email: string;
  level: OperatorLevel;
  onBackedUp: (key: BackedUpKey) => void;
}) => {
  const [made, setMade] = useState<Made | null>(null);
  const [error, setError] = useState<null | string>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { csrDer, privateKey } = await generateLeafKeyAndCSR({
          extensionRequest: { level },
          sans: [],
          subjectCn: email,
        });
        const passphrase = generateBackupPassphrase();
        const backupPem = await keyBackupPem(privateKey, passphrase);
        if (!cancelled) setMade({ backupPem, csrDer, passphrase });
      } catch (error_: unknown) {
        if (!cancelled)
          setError(error_ instanceof Error ? error_.message : "Key generation failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email, level]);

  if (error) {
    return (
      <p className="font-mono text-xs text-destructive" role="alert">
        {error}
      </p>
    );
  }

  if (!made) {
    return (
      <p className="font-mono text-xs text-muted-foreground" role="status">
        Making a P-384 key and CSR in this browser&hellip;
      </p>
    );
  }

  const filename = keyBackupFilename(level, email);

  return (
    <div className="space-y-3">
      <div
        className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3"
        role="note"
      >
        <p className="text-xs font-semibold text-foreground">
          Save the key backup and its passphrase
        </p>
        <p className="text-xs text-muted-foreground">
          The private key was made in this browser and never goes to the Fleet Manager. Download the
          encrypted key backup and store the passphrase in a password manager. The passphrase is
          shown only here, once; the same passphrase will protect the PKCS#12. Without both, the key
          is lost and the request has to start again.
        </p>
      </div>

      <div className="space-y-1">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Passphrase
        </span>
        <div className="flex items-center gap-2">
          <code
            aria-label="Key backup passphrase"
            className="flex-1 select-all break-all rounded-md border bg-secondary/40 px-3 py-2 font-mono text-sm"
          >
            {made.passphrase}
          </code>
          <Button
            onClick={() => void navigator.clipboard?.writeText(made.passphrase)}
            size="sm"
            type="button"
            variant="outline"
          >
            Copy
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            downloadText(filename, made.backupPem, "application/x-pem-file");
            setDownloaded(true);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          Download key backup
        </Button>
        <span className="font-mono text-[11px] text-muted-foreground">{filename}</span>
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input checked={saved} onChange={(e) => setSaved(e.target.checked)} type="checkbox" />I have
        saved the passphrase
      </label>

      <div className="flex justify-end">
        <Button
          disabled={!downloaded || !saved}
          onClick={() =>
            onBackedUp({ backup: new TextEncoder().encode(made.backupPem), csrDer: made.csrDer })
          }
          size="sm"
          type="button"
        >
          Continue
        </Button>
      </div>
    </div>
  );
};
