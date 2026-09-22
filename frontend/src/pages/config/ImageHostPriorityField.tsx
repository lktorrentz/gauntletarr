import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVerticalIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useSetSetting, useSetting } from '@/api/hooks/settings'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// Deve restare in sync con adapter_factory.DEFAULT_IMAGE_HOST_PRIORITY e
// con gli host realmente implementati (app/adapters/image_host/).
const KNOWN_HOSTS: Record<string, string> = {
  ptpimg: 'PTPImg',
  imgbox: 'Imgbox (nessuna api_key richiesta)',
  imgbb: 'ImgBB',
}
const DEFAULT_ORDER = ['ptpimg', 'imgbox', 'imgbb']

export function parseOrder(raw: string | null | undefined): string[] {
  const fromSetting = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []
  const known = fromSetting.filter((key) => key in KNOWN_HOSTS)
  // Host mai salvati (o un valore vuoto/mai impostato) vanno comunque
  // mostrati, in coda, nell'ordine di default — mai un host "invisibile"
  // solo perché non è ancora stato riordinato una volta.
  const missing = DEFAULT_ORDER.filter((key) => !known.includes(key))
  return [...known, ...missing]
}

function SortableRow({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm',
        isDragging && 'opacity-50',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label={`Trascina per riordinare ${label}`}
      >
        <GripVerticalIcon className="size-4" />
      </button>
      {label}
    </div>
  )
}

export function ImageHostPriorityField() {
  const { data } = useSetting('image_host_priority')
  const setSetting = useSetSetting('image_host_priority')
  const [draft, setDraft] = useState<string[] | null>(null)
  const order = draft ?? parseOrder(data?.value)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = order.indexOf(String(active.id))
    const newIndex = order.indexOf(String(over.id))
    const next = arrayMove(order, oldIndex, newIndex)
    setDraft(next)
    setSetting.mutate(next.join(','), {
      onSuccess: () => toast.success('Ordine di priorità salvato.'),
      onError: (error) => {
        toast.error(`Salvataggio fallito: ${error.message}`)
        setDraft(null)
      },
    })
  }

  return (
    <div className="grid gap-1.5">
      <Label>Ordine di priorità host immagini</Label>
      <p className="text-xs text-muted-foreground">
        Trascina per riordinare — si prova il primo, se fallisce si passa al successivo.
      </p>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="grid gap-1.5">
            {order.map((key) => (
              <SortableRow key={key} id={key} label={KNOWN_HOSTS[key]} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
