import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVerticalIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useSetSetting, useSetting } from '@/api/hooks/settings'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// Deve restare in sync con adapter_factory.DEFAULT_IMAGE_HOST_PRIORITY e
// con gli host realmente implementati (app/adapters/image_host/).
const KNOWN_HOSTS: Record<string, string> = {
  ptpimg: 'PTPImg',
  imgbox: 'Imgbox (nessuna api_key richiesta)',
  imgbb: 'ImgBB',
  pixhost: 'Pixhost (nessuna api_key richiesta)',
}
const DEFAULT_ORDER = ['ptpimg', 'imgbox', 'imgbb', 'pixhost']

// La lista salvata è esattamente quella "abilitata" (in ordine di
// priorità) — un host noto ma assente non viene più aggiunto in coda in
// automatico: da quando esiste uno spegnimento esplicito (vedi sotto),
// farlo riapparirebbe da solo un host che l'utente ha appena disabilitato.
// L'unico fallback è per un valore mai salvato: lì sì, tutto abilitato
// di default, nell'ordine noto.
export function parseOrder(raw: string | null | undefined): string[] {
  if (!raw) return [...DEFAULT_ORDER]
  return raw.split(',').map((s) => s.trim()).filter((key) => key in KNOWN_HOSTS)
}

export function disabledHosts(enabled: string[]): string[] {
  return DEFAULT_ORDER.filter((key) => !enabled.includes(key))
}

function SortableRow({ id, label, onDisable }: { id: string; label: string; onDisable: () => void }) {
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
      <span className="flex-1">{label}</span>
      <Button variant="ghost" size="icon-sm" title="Disabilita" onClick={onDisable}>
        <XIcon className="size-3.5" />
      </Button>
    </div>
  )
}

export function ImageHostPriorityField() {
  const { data } = useSetting('image_host_priority')
  const setSetting = useSetSetting('image_host_priority')
  const [draft, setDraft] = useState<string[] | null>(null)
  const order = draft ?? parseOrder(data?.value)
  const disabled = disabledHosts(order)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function save(next: string[], message: string) {
    setDraft(next)
    setSetting.mutate(next.join(','), {
      onSuccess: () => toast.success(message),
      onError: (error) => {
        toast.error(`Salvataggio fallito: ${error.message}`)
        setDraft(null)
      },
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = order.indexOf(String(active.id))
    const newIndex = order.indexOf(String(over.id))
    save(arrayMove(order, oldIndex, newIndex), 'Ordine di priorità salvato.')
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
              <SortableRow
                key={key}
                id={key}
                label={KNOWN_HOSTS[key]}
                onDisable={() => save(order.filter((k) => k !== key), `${KNOWN_HOSTS[key]} disabilitato.`)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {disabled.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2">
          {disabled.map((key) => (
            <Button
              key={key}
              variant="outline"
              size="sm"
              onClick={() => save([...order, key], `${KNOWN_HOSTS[key]} abilitato.`)}
            >
              + {KNOWN_HOSTS[key]}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
