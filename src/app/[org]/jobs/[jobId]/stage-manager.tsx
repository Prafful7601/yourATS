"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { addStage, deleteStage, moveStage, renameStage } from "../actions";

type Stage = { id: string; name: string; position: number };

export function StageManager({
  slug,
  jobId,
  stages,
}: {
  slug: string;
  jobId: string;
  stages: Stage[];
}) {
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newName, setNewName] = useState("");

  function run(fn: () => Promise<{ error: string | null }>) {
    startTransition(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <div className="grid gap-2">
      {stages.map((stage, i) => (
        <div
          key={stage.id}
          className="flex items-center gap-2 rounded-md border bg-background px-3 py-2"
        >
          <span className="w-5 text-center text-xs text-muted-foreground">
            {i + 1}
          </span>

          {editingId === stage.id ? (
            <>
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-8 flex-1"
                autoFocus
              />
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={pending}
                aria-label="Save stage name"
                onClick={() => {
                  run(() => renameStage(slug, stage.id, editValue));
                  setEditingId(null);
                }}
              >
                <Check className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Cancel"
                onClick={() => setEditingId(null)}
              >
                <X className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm font-medium">{stage.name}</span>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={pending || i === 0}
                aria-label="Move up"
                onClick={() => run(() => moveStage(slug, jobId, stage.id, "up"))}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={pending || i === stages.length - 1}
                aria-label="Move down"
                onClick={() =>
                  run(() => moveStage(slug, jobId, stage.id, "down"))
                }
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Rename stage"
                onClick={() => {
                  setEditingId(stage.id);
                  setEditValue(stage.name);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={pending || stages.length <= 1}
                aria-label="Delete stage"
                onClick={() => run(() => deleteStage(slug, stage.id))}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      ))}

      <div className="mt-2 flex items-center gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add a stage…"
          className="h-9"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newName.trim()) {
              e.preventDefault();
              run(() => addStage(slug, jobId, newName));
              setNewName("");
            }
          }}
        />
        <Button
          variant="outline"
          disabled={pending || !newName.trim()}
          onClick={() => {
            run(() => addStage(slug, jobId, newName));
            setNewName("");
          }}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>
    </div>
  );
}
