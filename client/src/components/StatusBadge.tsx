import { cn } from "@/lib/utils";

type RideStatus = "PENDENTE" | "ACEITA" | "A_CAMINHO" | "EM_ENTREGA" | "FINALIZADA" | "CANCELADA";

const STATUS_LABELS: Record<RideStatus, string> = {
  PENDENTE: "Pendente",
  ACEITA: "Aceita",
  A_CAMINHO: "A Caminho",
  EM_ENTREGA: "Em Entrega",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
};

const STATUS_CLASSES: Record<RideStatus, string> = {
  PENDENTE: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ACEITA: "bg-blue-100 text-blue-800 border-blue-200",
  A_CAMINHO: "bg-indigo-100 text-indigo-800 border-indigo-200",
  EM_ENTREGA: "bg-purple-100 text-purple-800 border-purple-200",
  FINALIZADA: "bg-green-100 text-green-800 border-green-200",
  CANCELADA: "bg-red-100 text-red-800 border-red-200",
};

interface StatusBadgeProps {
  status: RideStatus;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        STATUS_CLASSES[status],
        className
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export { STATUS_LABELS, STATUS_CLASSES };
export type { RideStatus };
