export function totalMonthlySales(movements: Array<{valor:number|string|null; evento_pagamento:string|null; tipo?:string|null}>): number {
  return movements.reduce((total, movement) => {
    const value = Number(movement.valor ?? 0);
    if (!Number.isFinite(value)) return total;
    return total + (movement.evento_pagamento === "ESTORNO" || movement.tipo === "ESTORNO" ? -value : value);
  }, 0);
}
