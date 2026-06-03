"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

import { moveApplication } from "./actions";

export type Card = {
  id: string;
  name: string;
  email: string | null;
  matchScore: number | null;
};
export type Column = { id: string; name: string; cards: Card[] };

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function CandidateCard({
  card,
  href,
  dragging,
}: {
  card: Card;
  href?: string;
  dragging?: boolean;
}) {
  return (
    <div
      className={cn(
        "group rounded-md border bg-card p-3 shadow-sm",
        dragging && "opacity-50"
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar className="size-7">
          <AvatarFallback className="text-xs">
            {initials(card.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{card.name}</p>
          {card.email && (
            <p className="truncate text-xs text-muted-foreground">
              {card.email}
            </p>
          )}
        </div>
        {card.matchScore != null && (
          <Badge variant="secondary" className="shrink-0">
            {card.matchScore}%
          </Badge>
        )}
        {href && (
          <Link
            href={href}
            aria-label={`Open ${card.name}`}
            onPointerDown={(e) => e.stopPropagation()}
            className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          >
            <ExternalLink className="size-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

function SortableCard({ card, href }: { card: Card; href: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="touch-none"
      {...attributes}
      {...listeners}
    >
      <CandidateCard card={card} href={href} dragging={isDragging} />
    </div>
  );
}

function ColumnView({
  column,
  cardIds,
  cards,
  hrefBase,
}: {
  column: { id: string; name: string };
  cardIds: string[];
  cards: Record<string, Card>;
  hrefBase: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/40">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-sm font-medium">{column.name}</span>
        <Badge variant="outline">{cardIds.length}</Badge>
      </div>
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex min-h-24 flex-1 flex-col gap-2 p-2 transition-colors",
            isOver && "bg-muted"
          )}
        >
          {cardIds.map((id) => (
            <SortableCard
              key={id}
              card={cards[id]}
              href={`${hrefBase}/${id}`}
            />
          ))}
          {cardIds.length === 0 && (
            <p className="px-1 py-6 text-center text-xs text-muted-foreground">
              Drop here
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function Board({
  slug,
  jobId,
  columns: initialColumns,
}: {
  slug: string;
  jobId: string;
  columns: Column[];
}) {
  const router = useRouter();

  // Lookup of every card by id (stable across columns).
  const cards = useMemo(() => {
    const map: Record<string, Card> = {};
    initialColumns.forEach((col) => col.cards.forEach((c) => (map[c.id] = c)));
    return map;
  }, [initialColumns]);

  const buildItems = () => {
    const items: Record<string, string[]> = {};
    initialColumns.forEach((col) => (items[col.id] = col.cards.map((c) => c.id)));
    return items;
  };

  const [items, setItems] = useState<Record<string, string[]>>(buildItems);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Resync when the server sends fresh data (after a move revalidates).
  useEffect(() => {
    setItems(buildItems());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const columnOrder = initialColumns.map((c) => ({ id: c.id, name: c.name }));

  function findContainer(id: string): string | undefined {
    if (id in items) return id;
    return Object.keys(items).find((key) => items[key].includes(id));
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeContainer = findContainer(String(active.id));
    const overContainer = findContainer(String(over.id));
    if (!activeContainer || !overContainer || activeContainer === overContainer)
      return;

    setItems((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const overIndex = overItems.indexOf(String(over.id));
      const insertAt = overIndex >= 0 ? overIndex : overItems.length;
      return {
        ...prev,
        [activeContainer]: activeItems.filter((id) => id !== active.id),
        [overContainer]: [
          ...overItems.slice(0, insertAt),
          String(active.id),
          ...overItems.slice(insertAt),
        ],
      };
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    const overContainer = findContainer(String(over.id));
    if (!overContainer) return;

    // Reorder within the destination column to the final index.
    let finalOrder = items[overContainer];
    const oldIndex = finalOrder.indexOf(String(active.id));
    const overIndex = finalOrder.indexOf(String(over.id));
    if (oldIndex !== -1 && overIndex !== -1 && oldIndex !== overIndex) {
      finalOrder = arrayMove(finalOrder, oldIndex, overIndex);
      setItems((prev) => ({ ...prev, [overContainer]: finalOrder }));
    }

    const res = await moveApplication(
      slug,
      jobId,
      String(active.id),
      overContainer,
      finalOrder
    );
    if (res.error) {
      toast.error(res.error);
      router.refresh();
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columnOrder.map((col) => (
          <ColumnView
            key={col.id}
            column={col}
            cardIds={items[col.id] ?? []}
            cards={cards}
            hrefBase={`/${slug}/jobs/${jobId}/applications`}
          />
        ))}
      </div>
      <DragOverlay>
        {activeId && cards[activeId] ? (
          <CandidateCard card={cards[activeId]} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
