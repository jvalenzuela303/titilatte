import React from 'react'
import dayjs from 'dayjs'
import type { Sale } from '@/types'

const DASH_LINE = '----------------------------------------'
const CENTER_WIDTH = 40

export function clp(amount: number): string {
  return `$${Math.round(amount).toLocaleString('es-CL')}`
}

function center(text: string): string {
  const pad = Math.max(0, Math.floor((CENTER_WIDTH - text.length) / 2))
  return ' '.repeat(pad) + text
}

function row(left: string, right: string): string {
  const maxLeft = CENTER_WIDTH - right.length - 1
  const l = left.length > maxLeft ? left.substring(0, maxLeft - 1) + '…' : left
  const spaces = CENTER_WIDTH - l.length - right.length
  return l + ' '.repeat(Math.max(1, spaces)) + right
}

const PAYMENT_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
}

const ThermalReceipt: React.FC<{ sale: Sale }> = ({ sale }) => {
  // Usar los valores reales del backend (calculados por línea de producto)
  const iva  = sale.taxAmount
  const neto = sale.totalAmount - iva

  const lines: string[] = [
    center('MINIMARKET'),
    center('RUT: 76.123.456-7'),
    center('Av. Principal 123, Santiago'),
    center('Tel: (2) 2345-6789'),
    DASH_LINE,
    center('BOLETA DE VENTAS Y SERVICIOS'),
    center(`N° ${String(sale.saleNumber).padStart(6, '0')}`),
    center(dayjs(sale.createdAt).format('DD/MM/YYYY HH:mm:ss')),
    DASH_LINE,
  ]

  for (const d of sale.details) {
    const name =
      d.productName.length > CENTER_WIDTH
        ? d.productName.substring(0, CENTER_WIDTH - 1) + '…'
        : d.productName
    lines.push(name)
    lines.push(row(`  ${d.quantity} x ${clp(d.unitPrice)}`, clp(d.subtotal)))
  }

  lines.push(DASH_LINE)
  lines.push(row('NETO:', clp(neto)))
  if (iva > 0) {
    lines.push(row('IVA (19%):', clp(iva)))
  } else {
    lines.push(row('IVA:', 'EXENTO'))
  }
  if (sale.discountAmount > 0) {
    lines.push(row('Descuento:', `-${clp(sale.discountAmount)}`))
  }
  lines.push(DASH_LINE)
  lines.push(row('TOTAL:', clp(sale.totalAmount)))
  lines.push(DASH_LINE)

  for (const p of sale.payments) {
    if (p.amount > 0) {
      lines.push(row(`${PAYMENT_LABELS[p.method] ?? p.method}:`, clp(p.amount)))
    }
    if (p.changeAmount > 0) {
      lines.push(row('Vuelto:', clp(p.changeAmount)))
    }
  }

  lines.push(DASH_LINE)
  lines.push(center(`Cajero: ${sale.seller.firstName} ${sale.seller.lastName}`))
  lines.push(center('Documento tributario electronico'))
  lines.push(center('¡Gracias por su compra!'))
  lines.push(DASH_LINE)

  return (
    <pre
      style={{
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: '11px',
        lineHeight: '1.4',
        margin: 0,
        padding: 0,
        whiteSpace: 'pre',
        color: '#000',
        background: '#fff',
      }}
    >
      {lines.join('\n')}
    </pre>
  )
}

export default ThermalReceipt
