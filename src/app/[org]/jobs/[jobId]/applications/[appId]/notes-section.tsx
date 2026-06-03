"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { addNote, deleteNote } from "./actions";

export type Note = {
  id: string;
  body: string;
  created_at: string;
  authorId: string | null;
  authorName: string;
};

export function NotesSection({
  slug,
  jobId,
  appId,
  currentUserId,
  notes,
}: {
  slug: string;
  jobId: string;
  appId: string;
  currentUserId: string;
  notes: Note[];
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!body.trim()) return;
    startTransition(async () => {
      const res = await addNote(slug, jobId, appId, body);
      if (res.error) toast.error(res.error);
      else setBody("");
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note about this candidate…"
          rows={3}
        />
        <div className="flex justify-end">
          <Button size="sm" disabled={pending || !body.trim()} onClick={submit}>
            {pending ? "Adding…" : "Add note"}
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="grid gap-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md border bg-background p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{note.authorName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(note.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                  {note.authorId === currentUserId && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="Delete note"
                      onClick={() =>
                        startTransition(async () => {
                          const res = await deleteNote(
                            slug,
                            jobId,
                            appId,
                            note.id
                          );
                          if (res.error) toast.error(res.error);
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {note.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
