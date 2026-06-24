import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Col,
  Row,
  Tabs,
  Tag,
  Typography,
  Button,
  Space,
  Divider,
  Steps,
  List,
  Collapse,
  theme,
  Badge,
} from 'antd'
import {
  SettingOutlined,
  DashboardOutlined,
  ShoppingCartOutlined,
  BarChartOutlined,
  AppstoreOutlined,
  InboxOutlined,
  ShoppingOutlined,
  WalletOutlined,
  BellOutlined,
  TagsOutlined,
  CalendarOutlined,
  UserOutlined,
  ShopOutlined,
  ArrowLeftOutlined,
  TeamOutlined,
  FileTextOutlined,
  TagOutlined,
  UnorderedListOutlined,
  CheckCircleOutlined,
  BulbOutlined,
  RightOutlined,
  LockOutlined,
} from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography

type RolKey = 'ADMIN' | 'SUPERVISOR' | 'CAJERO' | 'BODEGA'

interface ModuloCard {
  icono: React.ReactNode
  titulo: string
  descripcion: string
  ruta?: string
  pasos: string[]
  acciones: string[]
  tip: string
  soloRoles?: string[]
}

interface RolInfo {
  label: string
  color: string
  bgColor: string
  descripcion: string
  modulos: ModuloCard[]
}

const roles: Record<RolKey, RolInfo> = {
  ADMIN: {
    label: 'Administrador',
    color: '#722ed1',
    bgColor: '#f9f0ff',
    descripcion:
      'Acceso total al sistema. Configura la tienda, gestiona usuarios, define categorías y consulta reportes globales.',
    modulos: [
      {
        icono: <DashboardOutlined style={{ fontSize: 26 }} />,
        titulo: 'Dashboard',
        descripcion: 'Vista ejecutiva con KPIs en tiempo real: ventas del día, stock crítico, alertas activas y tendencias de la semana.',
        ruta: '/dashboard',
        pasos: [
          'Al iniciar sesión aterrizas en el Dashboard automáticamente.',
          'Revisa el panel de "Ventas Hoy" para el acumulado del turno actual.',
          'Consulta "Productos con stock crítico" para planificar reposición.',
          'Haz clic en cualquier KPI para ir directo al módulo relacionado.',
        ],
        acciones: [
          'Ver ventas del día / semana / mes',
          'Identificar productos agotados o bajo mínimo',
          'Ver alertas pendientes por atender',
          'Acceder rápido a cualquier módulo del sistema',
        ],
        tip: 'El dashboard se actualiza cada 15 segundos automáticamente. No necesitas recargar la página.',
      },
      {
        icono: <ShoppingCartOutlined style={{ fontSize: 26 }} />,
        titulo: 'Punto de Venta (POS)',
        descripcion: 'Terminal de venta completa. Escanea o busca productos, aplica descuentos y cobra en efectivo o tarjeta.',
        ruta: '/pos',
        pasos: [
          'Verifica que haya una caja abierta antes de vender (módulo Caja).',
          'Escanea el código de barras o busca el producto por nombre.',
          'Ajusta cantidades haciendo clic en el ítem del carrito.',
          'Selecciona el método de pago: efectivo o tarjeta.',
          'Si es efectivo, ingresa el monto recibido para calcular el vuelto.',
          'Confirma la venta — se emite el comprobante automáticamente.',
        ],
        acciones: [
          'Escanear código de barras',
          'Buscar productos por nombre o código',
          'Aplicar descuento porcentual o monto fijo',
          'Cobrar en efectivo con cálculo de vuelto',
          'Cobrar con tarjeta de débito/crédito',
          'Anular una venta reciente (requiere ADMIN o SUPERVISOR)',
        ],
        tip: 'Presiona F2 o el ícono de búsqueda para enfocar el campo de búsqueda rápidamente sin usar el mouse.',
      },
      {
        icono: <BarChartOutlined style={{ fontSize: 26 }} />,
        titulo: 'Reportes',
        descripcion: 'Genera y exporta reportes de ventas, márgenes por producto, flujo de caja y desempeño por período.',
        ruta: '/reports',
        pasos: [
          'Selecciona el tipo de reporte: Ventas, Productos, Caja o Inventario.',
          'Define el rango de fechas con el selector de período.',
          'Aplica filtros opcionales: cajero, categoría o sucursal.',
          'Previsualiza los datos en la tabla antes de exportar.',
          'Haz clic en "Exportar Excel" para descargar el archivo .xlsx.',
        ],
        acciones: [
          'Reporte de ventas por período',
          'Ranking de productos más vendidos',
          'Margen de ganancia por categoría',
          'Flujo de caja por turno',
          'Exportar a Excel (.xlsx)',
        ],
        tip: 'Los reportes de cierre de mes quedan bloqueados una vez ejecutado el cierre de período. Guarda el Excel antes de cerrar.',
      },
      {
        icono: <TagsOutlined style={{ fontSize: 26 }} />,
        titulo: 'Categorías',
        descripcion: 'Organiza el catálogo de productos en categorías para facilitar la búsqueda en el POS y los reportes.',
        ruta: '/categories',
        pasos: [
          'Haz clic en "Nueva categoría" e ingresa el nombre.',
          'Asigna un color o ícono para identificación visual rápida.',
          'Guarda la categoría — ya estará disponible al crear productos.',
          'Para editar, haz clic en el ícono de lápiz junto a la categoría.',
          'Para desactivar, usa el switch — los productos asociados no se borran.',
        ],
        acciones: [
          'Crear nueva categoría',
          'Editar nombre y color',
          'Activar / desactivar categoría',
          'Ver productos asociados a cada categoría',
        ],
        tip: 'Crea las categorías principales antes de cargar el catálogo de productos. Luego es más difícil reorganizarlos.',
        soloRoles: ['ADMIN', 'SUPERVISOR'],
      },
      {
        icono: <TagOutlined style={{ fontSize: 26 }} />,
        titulo: 'Promociones',
        descripcion: 'Configura descuentos automáticos por producto, categoría o fechas especiales que se aplican en el POS.',
        ruta: '/promotions',
        pasos: [
          'Haz clic en "Nueva promoción" y elige el tipo: producto o categoría.',
          'Define el descuento: porcentaje (%) o monto fijo ($).',
          'Configura las fechas de vigencia (inicio y término).',
          'Activa la promoción — el POS la aplicará automáticamente.',
          'Verifica en el POS que el precio descontado aparezca correctamente.',
        ],
        acciones: [
          'Descuento por producto específico',
          'Descuento por categoría completa',
          'Vigencia por rango de fechas',
          'Activar / desactivar sin borrar',
          'Ver historial de promociones pasadas',
        ],
        tip: 'Las promociones se aplican automáticamente en el POS al agregar el producto. El cajero verá el precio original tachado y el precio con descuento.',
      },
      {
        icono: <SettingOutlined style={{ fontSize: 26 }} />,
        titulo: 'Configuración',
        descripcion: 'Parámetros globales de la tienda: nombre, RUT, logo, IVA, datos de contacto y configuración de tickets.',
        ruta: '/store-config',
        pasos: [
          'Ve a Configuración desde el menú lateral (solo ADMIN).',
          'Actualiza el nombre y RUT de la tienda (aparecen en los tickets).',
          'Sube el logo en formato PNG o JPG (se muestra en el ticket impreso).',
          'Verifica que el porcentaje de IVA sea correcto (19% por defecto en Chile).',
          'Guarda los cambios — se aplican inmediatamente a los nuevos tickets.',
        ],
        acciones: [
          'Editar nombre y RUT del negocio',
          'Subir o cambiar el logo',
          'Configurar porcentaje de IVA',
          'Definir dirección y teléfono de contacto',
          'Personalizar pie de ticket',
        ],
        tip: 'Completa la configuración antes de comenzar a vender. El nombre del negocio y el RUT son obligatorios para los comprobantes.',
        soloRoles: ['ADMIN'],
      },
      {
        icono: <TeamOutlined style={{ fontSize: 26 }} />,
        titulo: 'Usuarios',
        descripcion: 'Administra las cuentas del equipo: crea usuarios, asigna roles y controla el acceso al sistema.',
        ruta: '/store-config',
        pasos: [
          'Ve a Configuración → pestaña "Usuarios".',
          'Haz clic en "Nuevo usuario" e ingresa nombre, email y rol.',
          'El usuario recibirá un email con su contraseña temporal.',
          'Para cambiar el rol de alguien, edita su perfil y selecciona el nuevo rol.',
          'Para revocar acceso, desactiva la cuenta con el switch — no se borra el historial.',
        ],
        acciones: [
          'Crear cuenta con rol CAJERO, BODEGA o SUPERVISOR',
          'Asignar y cambiar roles',
          'Activar / desactivar cuentas',
          'Ver último acceso de cada usuario',
          'Restablecer contraseña',
        ],
        tip: 'Crea al menos un usuario SUPERVISOR además del ADMIN. Así siempre hay alguien que puede autorizar anulaciones si el ADMIN no está disponible.',
        soloRoles: ['ADMIN'],
      },
      {
        icono: <CalendarOutlined style={{ fontSize: 26 }} />,
        titulo: 'Cierre de Período',
        descripcion: 'Ejecuta el cierre contable mensual que consolida las ventas y bloquea modificaciones del período.',
        ruta: '/period-close',
        pasos: [
          'Asegúrate de que todas las cajas del día estén cerradas.',
          'Descarga el reporte de ventas del mes antes de cerrar.',
          'Ve a Cierre de Período y selecciona el mes a cerrar.',
          'Revisa el resumen de totales y confirma que los números sean correctos.',
          'Haz clic en "Ejecutar cierre" — esta acción no se puede deshacer.',
          'Descarga el acta de cierre generada en PDF.',
        ],
        acciones: [
          'Ver resumen del período antes del cierre',
          'Ejecutar cierre mensual',
          'Descargar acta de cierre en PDF',
          'Ver histórico de períodos cerrados',
        ],
        tip: 'El cierre bloquea permanentemente el período. Una vez ejecutado, no se pueden registrar ventas ni ajustes en esas fechas. Coordina con el equipo antes de cerrarlo.',
        soloRoles: ['ADMIN'],
      },
    ],
  },

  SUPERVISOR: {
    label: 'Supervisor',
    color: '#1677ff',
    bgColor: '#e6f4ff',
    descripcion:
      'Supervisa la operación diaria. Gestiona inventario, revisa compras, controla el stock y autoriza acciones que los cajeros no pueden realizar.',
    modulos: [
      {
        icono: <DashboardOutlined style={{ fontSize: 26 }} />,
        titulo: 'Dashboard',
        descripcion: 'Vista del turno actual: ventas acumuladas, cajas abiertas, alertas activas y productos con stock crítico.',
        ruta: '/dashboard',
        pasos: [
          'Revisa el panel de ventas al iniciar cada turno.',
          'Controla cuántas cajas están abiertas y quién las opera.',
          'Atiende las alertas de stock para gestionar reposición.',
          'Al final del turno, anota el total de ventas para comparar con el arqueo.',
        ],
        acciones: [
          'Ver ventas del turno en tiempo real',
          'Verificar cajas abiertas y operadores',
          'Revisar alertas de inventario pendientes',
          'Acceder directamente a cualquier módulo',
        ],
        tip: 'Configura el Dashboard como pestaña de inicio en el navegador para que sea lo primero que veas cada mañana.',
      },
      {
        icono: <ShoppingCartOutlined style={{ fontSize: 26 }} />,
        titulo: 'Punto de Venta (POS)',
        descripcion: 'Opera la caja en reemplazo del cajero y puede anular ventas recientes con clave de supervisor.',
        ruta: '/pos',
        pasos: [
          'Abre una caja desde el módulo Caja antes de vender.',
          'Usa el buscador o escáner para agregar productos al carrito.',
          'Para anular una venta, ve al módulo Ventas, selecciona la venta y haz clic en "Anular".',
          'Ingresa el motivo de anulación — queda registrado en el sistema.',
        ],
        acciones: [
          'Operar el POS como cajero',
          'Anular ventas del día actual',
          'Aplicar descuentos especiales',
          'Ver historial de ventas en tiempo real',
        ],
        tip: 'Solo se pueden anular ventas del turno actual. Las ventas de días anteriores requieren un ajuste de caja autorizado por ADMIN.',
      },
      {
        icono: <UnorderedListOutlined style={{ fontSize: 26 }} />,
        titulo: 'Ventas',
        descripcion: 'Historial completo de transacciones con filtros por cajero, producto, método de pago y rango de fecha.',
        ruta: '/sales',
        pasos: [
          'Accede al módulo Ventas desde el menú lateral.',
          'Usa el filtro de fechas para acotar el período que te interesa.',
          'Filtra por cajero para revisar el desempeño de un operador específico.',
          'Haz clic en una venta para ver el detalle de productos e importes.',
          'Exporta el listado con el botón "Exportar Excel" si necesitas analizarlo.',
        ],
        acciones: [
          'Filtrar por cajero, fecha o producto',
          'Ver detalle de cada venta (productos, precios, descuentos)',
          'Identificar ventas anuladas',
          'Exportar listado a Excel',
          'Anular ventas del día desde el detalle',
        ],
        tip: 'Compara el total del módulo Ventas con el arqueo de caja al final del turno. Si hay diferencias, usa los filtros para ubicar la transacción con discrepancia.',
      },
      {
        icono: <AppstoreOutlined style={{ fontSize: 26 }} />,
        titulo: 'Productos',
        descripcion: 'Gestiona el catálogo completo: crea productos, actualiza precios, asigna categorías y establece stock mínimo.',
        ruta: '/products',
        pasos: [
          'Haz clic en "Nuevo producto" e ingresa nombre, código de barras y precio.',
          'Asigna la categoría correspondiente para facilitar la búsqueda en el POS.',
          'Define el stock mínimo — cuando llegue a ese valor, el sistema generará una alerta.',
          'Para actualizar el precio, edita el producto y guarda.',
          'Para desactivar temporalmente un producto (agotado), usa el switch de estado.',
        ],
        acciones: [
          'Crear producto con código de barras',
          'Editar precio de venta y costo',
          'Asignar categoría',
          'Definir stock mínimo para alertas',
          'Activar / desactivar productos',
          'Buscar por nombre, código o categoría',
        ],
        tip: 'Mantén el código de barras actualizado en cada producto. Agiliza enormemente el proceso de venta en el POS y reduce errores de digitación.',
      },
      {
        icono: <InboxOutlined style={{ fontSize: 26 }} />,
        titulo: 'Stock',
        descripcion: 'Control de inventario en tiempo real. Registra movimientos, ajusta existencias y consulta el historial de cambios.',
        ruta: '/stock',
        pasos: [
          'Ve al módulo Stock para ver las existencias actuales de todos los productos.',
          'Usa el filtro "Stock crítico" para ver solo los productos bajo mínimo.',
          'Para ajustar stock manualmente: selecciona el producto → "Ajuste" → ingresa cantidad y motivo.',
          'Para registrar una merma: selecciona → "Salida" → tipo "Merma" → ingresa cantidad.',
          'Consulta el historial de un producto haciendo clic en su nombre.',
        ],
        acciones: [
          'Ver stock actual de todos los productos',
          'Filtrar por stock crítico o agotado',
          'Registrar ajuste de inventario',
          'Registrar merma o pérdida',
          'Ver historial de movimientos por producto',
          'Exportar inventario actual a Excel',
        ],
        tip: 'Realiza un conteo físico de inventario al menos una vez al mes y compara con el sistema. Usa "Ajuste" para corregir diferencias y agrega el motivo para mantener la trazabilidad.',
      },
      {
        icono: <ShoppingOutlined style={{ fontSize: 26 }} />,
        titulo: 'Compras',
        descripcion: 'Gestiona órdenes de compra a proveedores: crea pedidos, recepciona mercadería y actualiza el stock automáticamente.',
        ruta: '/purchases',
        pasos: [
          'Haz clic en "Nueva compra" y selecciona el proveedor.',
          'Agrega los productos con las cantidades pedidas.',
          'Guarda la orden — queda en estado "Pendiente" hasta recibirla.',
          'Cuando llegue la mercadería, abre la orden y haz clic en "Recepcionar".',
          'Verifica cantidad recibida vs. pedida. Si hay diferencias, ajústala antes de confirmar.',
          'Confirma la recepción — el stock se actualiza automáticamente.',
        ],
        acciones: [
          'Crear orden de compra con proveedor',
          'Agregar múltiples productos por orden',
          'Recepcionar mercadería parcial o total',
          'Registrar discrepancias en la recepción',
          'Ver historial de compras por proveedor',
          'Filtrar por estado: Pendiente / Recibida / Parcial',
        ],
        tip: 'No confirmes la recepción si no contaste físicamente la mercadería. Una recepción incorrecta afecta el stock y puede generar diferencias en el inventario.',
      },
      {
        icono: <TagsOutlined style={{ fontSize: 26 }} />,
        titulo: 'Categorías',
        descripcion: 'Consulta y organiza las categorías del catálogo para mantener el inventario estructurado.',
        ruta: '/categories',
        pasos: [
          'Revisa las categorías existentes antes de crear un producto nuevo.',
          'Si falta una categoría, créala aquí antes de agregar los productos.',
          'Puedes editar el nombre de una categoría sin afectar los productos asociados.',
        ],
        acciones: [
          'Ver todas las categorías activas',
          'Crear nueva categoría',
          'Editar nombre de categoría existente',
          'Ver cantidad de productos por categoría',
        ],
        tip: 'Mantén las categorías en no más de 10-15 opciones. Demasiadas categorías dificultan la búsqueda en el POS.',
        soloRoles: ['ADMIN', 'SUPERVISOR'],
      },
      {
        icono: <BarChartOutlined style={{ fontSize: 26 }} />,
        titulo: 'Reportes',
        descripcion: 'Genera reportes de ventas y stock para análisis del turno o período supervisado.',
        ruta: '/reports',
        pasos: [
          'Selecciona el tipo de reporte según lo que necesitas analizar.',
          'Define el rango de fechas — puedes usar atajos: Hoy, Esta semana, Este mes.',
          'Filtra por cajero si quieres ver el desempeño de un operador específico.',
          'Exporta a Excel para compartir con el administrador.',
        ],
        acciones: [
          'Reporte de ventas por turno o período',
          'Ventas por cajero',
          'Productos más vendidos',
          'Stock actual y valorizado',
          'Exportar a Excel',
        ],
        tip: 'Genera el reporte de ventas al final de cada turno y compáralo con el arqueo de caja para detectar diferencias antes de cerrar.',
      },
      {
        icono: <BellOutlined style={{ fontSize: 26 }} />,
        titulo: 'Alertas',
        descripcion: 'Centro de notificaciones en tiempo real: stock bajo mínimo, cajas sin cerrar y eventos críticos del sistema.',
        ruta: '/alerts',
        pasos: [
          'Las alertas llegan automáticamente — no necesitas buscarlas.',
          'Haz clic en una alerta para ir directo al módulo donde debes actuar.',
          'Una vez atendida, márcala como "Resuelta" para limpiar la lista.',
          'Configura qué tipos de alertas quieres recibir desde tu perfil.',
        ],
        acciones: [
          'Ver alertas activas en tiempo real',
          'Filtrar por tipo: stock, caja, sistema',
          'Navegar al módulo afectado desde la alerta',
          'Marcar alertas como resueltas',
        ],
        tip: 'Revisa las alertas al inicio de cada turno. Una alerta de stock ignorada puede resultar en un producto agotado durante las horas de mayor venta.',
      },
    ],
  },

  CAJERO: {
    label: 'Cajero',
    color: '#52c41a',
    bgColor: '#f6ffed',
    descripcion:
      'Opera la caja registradora. Registra ventas, gestiona el efectivo del turno y consulta sus propias transacciones.',
    modulos: [
      {
        icono: <ShoppingCartOutlined style={{ fontSize: 26 }} />,
        titulo: 'Punto de Venta (POS)',
        descripcion: 'Pantalla principal de trabajo. Escanea productos, cobra y emite comprobantes durante el turno.',
        ruta: '/pos',
        pasos: [
          'Primero abre tu caja en el módulo "Caja" → "Abrir caja" con el fondo inicial.',
          'En el POS, escanea el código de barras del producto o búscalo por nombre.',
          'Verifica que el precio y la cantidad sean correctos en el carrito.',
          'Selecciona el método de pago: Efectivo o Tarjeta.',
          'Si es efectivo: ingresa el monto recibido → el sistema calcula el vuelto.',
          'Confirma la venta — el comprobante se genera automáticamente.',
          'Para el siguiente cliente, el carrito se limpia solo.',
        ],
        acciones: [
          'Escanear código de barras',
          'Buscar producto por nombre o código',
          'Cambiar cantidad de un producto en el carrito',
          'Eliminar producto del carrito',
          'Cobrar en efectivo con cálculo de vuelto automático',
          'Cobrar con tarjeta débito / crédito',
          'Imprimir o reenviar comprobante',
        ],
        tip: 'Si cometes un error antes de confirmar la venta, puedes eliminar productos del carrito o usar el botón "Limpiar" para empezar de cero. No es posible anular sin el supervisor una vez confirmada.',
      },
      {
        icono: <UnorderedListOutlined style={{ fontSize: 26 }} />,
        titulo: 'Mis Ventas',
        descripcion: 'Historial de las ventas que registraste en el turno actual y en turnos anteriores.',
        ruta: '/sales',
        pasos: [
          'Accede a "Ventas" desde el menú lateral para ver tu historial.',
          'Por defecto verás las ventas del día actual.',
          'Haz clic en cualquier venta para ver el detalle (productos, precios, método de pago).',
          'Usa el filtro de fechas si necesitas revisar ventas de días anteriores.',
          'Si detectas un error en una venta, avisa al supervisor — él puede anularla.',
        ],
        acciones: [
          'Ver ventas del turno actual',
          'Ver ventas de turnos anteriores',
          'Ver detalle de cada transacción',
          'Verificar método de pago de cada venta',
          'Identificar si una venta fue anulada',
        ],
        tip: 'Revisa tus ventas al final del turno antes del arqueo. Si el total del sistema no coincide con tu caja, identifica la diferencia aquí antes de llamar al supervisor.',
      },
      {
        icono: <WalletOutlined style={{ fontSize: 26 }} />,
        titulo: 'Caja',
        descripcion: 'Gestión del efectivo del turno: apertura con fondo inicial y cierre con arqueo al finalizar.',
        ruta: '/cash',
        pasos: [
          'Al comenzar el turno: ve a Caja → "Abrir caja" → ingresa el fondo inicial en efectivo.',
          'Vende normalmente durante el turno — las ventas en efectivo se acumulan en tu caja.',
          'Al finalizar el turno: ve a Caja → "Cerrar caja".',
          'Cuenta el efectivo físico e ingresa el total contado.',
          'El sistema muestra la diferencia entre lo esperado y lo contado.',
          'Confirma el cierre — el supervisor recibirá el resumen del turno.',
        ],
        acciones: [
          'Abrir caja con fondo inicial',
          'Ver resumen de ventas en efectivo del turno',
          'Registrar retiro de efectivo durante el turno',
          'Cerrar caja con arqueo',
          'Ver historial de cierres anteriores',
        ],
        tip: 'Nunca cierres la caja sin contar el efectivo físico primero. Si hay diferencia, el sistema la registra — es mejor reportarla tú que sea detectada después.',
      },
      {
        icono: <BellOutlined style={{ fontSize: 26 }} />,
        titulo: 'Alertas',
        descripcion: 'Notificaciones relevantes para tu caja: productos agotados, acciones pendientes y avisos del sistema.',
        ruta: '/alerts',
        pasos: [
          'Las alertas aparecen automáticamente en la campana del menú superior.',
          'Un punto rojo indica alertas sin leer.',
          'Haz clic en la campana para ver el listado de alertas activas.',
          'Si un producto aparece como "Agotado", notifica al supervisor o bodega.',
        ],
        acciones: [
          'Ver alertas activas',
          'Identificar productos agotados durante la venta',
          'Recibir avisos del supervisor',
        ],
        tip: 'Si en el POS un producto no aparece o dice "sin stock", revisa las alertas — puede estar agotado o desactivado. Avisa al supervisor inmediatamente.',
      },
    ],
  },

  BODEGA: {
    label: 'Bodega',
    color: '#fa8c16',
    bgColor: '#fff7e6',
    descripcion:
      'Controla el inventario físico. Recepciona mercadería, ajusta existencias, registra mermas y monitorea alertas de reposición.',
    modulos: [
      {
        icono: <InboxOutlined style={{ fontSize: 26 }} />,
        titulo: 'Stock',
        descripcion: 'Vista completa del inventario con movimientos en tiempo real. Registra entradas, salidas y ajustes.',
        ruta: '/stock',
        pasos: [
          'Accede a Stock para ver las existencias actuales de todos los productos.',
          'Usa el filtro "Stock crítico" para priorizar los productos a reponer.',
          'Para registrar una entrada manual: producto → "Entrada" → ingresa cantidad y motivo.',
          'Para registrar merma o rotura: producto → "Salida" → tipo "Merma" → cantidad.',
          'Para corregir un error de conteo: producto → "Ajuste" → nueva cantidad + motivo.',
          'Consulta el historial de cualquier producto haciendo clic en su nombre.',
        ],
        acciones: [
          'Ver stock actual de todo el inventario',
          'Filtrar por categoría, stock crítico o agotado',
          'Registrar entrada de mercadería',
          'Registrar salida por merma, vencimiento o rotura',
          'Ajustar inventario por conteo físico',
          'Ver historial de movimientos por producto',
          'Exportar inventario valorizado a Excel',
        ],
        tip: 'Siempre ingresa el motivo de cada ajuste. En caso de auditoría, la trazabilidad de movimientos es fundamental para explicar las diferencias.',
      },
      {
        icono: <ShoppingOutlined style={{ fontSize: 26 }} />,
        titulo: 'Compras',
        descripcion: 'Recepciona las órdenes de compra: valida cantidades recibidas contra lo pedido y actualiza el stock.',
        ruta: '/purchases',
        pasos: [
          'Ve a Compras y filtra por estado "Pendiente" para ver las órdenes por recibir.',
          'Abre la orden correspondiente a la guía de despacho del proveedor.',
          'Compara ítem por ítem las cantidades de la guía con las de la orden.',
          'Si hay diferencias, ajusta la cantidad recibida antes de confirmar.',
          'Haz clic en "Recepcionar" — el stock se actualiza automáticamente.',
          'Adjunta la guía de despacho escaneada si el sistema lo permite.',
        ],
        acciones: [
          'Ver órdenes pendientes de recepción',
          'Recepcionar mercadería completa',
          'Recepcionar parcialmente (si llegó menos)',
          'Registrar diferencias entre pedido y recibido',
          'Ver historial de compras recibidas',
          'Buscar por proveedor o número de orden',
        ],
        tip: 'Revisa las fechas de vencimiento al recepcionar productos perecederos. Si algo llega vencido o en mal estado, no lo recepciones — avisa al supervisor antes de rechazar la entrega.',
      },
      {
        icono: <AppstoreOutlined style={{ fontSize: 26 }} />,
        titulo: 'Productos',
        descripcion: 'Consulta el catálogo para verificar códigos de barras, unidades de medida y umbrales de stock mínimo.',
        ruta: '/products',
        pasos: [
          'Usa el buscador para encontrar un producto por nombre o código.',
          'Verifica que el código de barras del producto coincida con el físico.',
          'Consulta el stock mínimo configurado para saber cuándo generar una alerta.',
          'Si un código de barras está mal, notifica al supervisor para que lo corrija.',
        ],
        acciones: [
          'Buscar producto por nombre o código de barras',
          'Consultar stock mínimo configurado',
          'Ver unidad de medida (unidad, kg, litros)',
          'Verificar si el producto está activo',
        ],
        tip: 'Como bodega tienes acceso de lectura al catálogo. Para modificar precios o crear productos nuevos, solicítalo al supervisor o administrador.',
      },
      {
        icono: <BellOutlined style={{ fontSize: 26 }} />,
        titulo: 'Alertas',
        descripcion: 'Notificaciones automáticas cuando un producto cae por debajo del stock mínimo configurado.',
        ruta: '/alerts',
        pasos: [
          'Revisa las alertas al inicio de cada jornada.',
          'Una alerta de "Stock mínimo" indica que debes gestionar la reposición.',
          'Haz clic en la alerta para ir directo al producto afectado en el inventario.',
          'Avisa al supervisor o crea la orden de compra correspondiente.',
          'Una vez repuesto el stock, la alerta se resuelve automáticamente.',
        ],
        acciones: [
          'Ver alertas de stock bajo mínimo',
          'Identificar productos agotados',
          'Navegar al producto desde la alerta',
          'Ver historial de alertas resueltas',
        ],
        tip: 'Activa las notificaciones del navegador para recibir alertas en tiempo real aunque no tengas el módulo abierto. Así puedes actuar antes de que el producto se agote por completo.',
      },
      {
        icono: <DashboardOutlined style={{ fontSize: 26 }} />,
        titulo: 'Dashboard de Inventario',
        descripcion: 'Indicadores clave de inventario: productos en stock crítico, pendientes de recepción y movimientos recientes.',
        ruta: '/dashboard',
        pasos: [
          'El dashboard muestra un resumen ejecutivo del estado del inventario.',
          'Revisa el contador de "Productos bajo mínimo" para priorizar tu trabajo.',
          'El panel de "Compras pendientes" muestra cuántas órdenes esperan recepción.',
          'Los movimientos recientes muestran las últimas entradas y salidas registradas.',
        ],
        acciones: [
          'Ver productos en stock crítico',
          'Ver compras pendientes de recepción',
          'Consultar movimientos recientes',
          'Acceder rápido a Stock y Compras',
        ],
        tip: 'Empieza tu jornada en el Dashboard para tener una visión completa antes de ir a la bodega. Así sabes qué revisar primero sin recorrer todos los módulos.',
      },
    ],
  },
}

const flujoSteps = [
  {
    title: 'Administrador',
    description: 'Configura la tienda, crea el catálogo y gestiona usuarios antes de operar.',
    icon: <SettingOutlined />,
  },
  {
    title: 'Bodega',
    description: 'Recepciona la mercadería y mantiene el stock actualizado cada día.',
    icon: <InboxOutlined />,
  },
  {
    title: 'Supervisor',
    description: 'Supervisa el turno, autoriza ajustes y revisa que todo esté en orden.',
    icon: <TeamOutlined />,
  },
  {
    title: 'Cajero',
    description: 'Abre caja, registra ventas durante el turno y realiza el arqueo al cerrar.',
    icon: <ShoppingCartOutlined />,
  },
]

const TutorialPage: React.FC = () => {
  const [rolActivo, setRolActivo] = useState<RolKey>('CAJERO')
  const navigate = useNavigate()
  const { token } = theme.useToken()

  const rolInfo = roles[rolActivo]

  const tabItems = (Object.entries(roles) as [RolKey, RolInfo][]).map(([key, info]) => ({
    key,
    label: <span style={{ fontWeight: 600 }}>{info.label}</span>,
  }))

  return (
    <div
      style={{
        minHeight: '100vh',
        background: `linear-gradient(160deg, ${token.colorBgLayout} 0%, #f0f5ff 100%)`,
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          background: '#fff',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: token.boxShadowTertiary,
        }}
      >
        <Space align="center" size={12}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: token.colorPrimary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShopOutlined style={{ fontSize: 18, color: '#fff' }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, lineHeight: 1.2 }}>
              S3Suite · Minimarket
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Guía de uso por rol
            </Text>
          </div>
        </Space>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/login')}>
          Volver al login
        </Button>
      </div>

      {/* ── Hero ── */}
      <div style={{ textAlign: 'center', padding: '40px 24px 28px', maxWidth: 680, margin: '0 auto' }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          ¿Cómo usar la plataforma?
        </Title>
        <Paragraph type="secondary" style={{ fontSize: 15, marginBottom: 0 }}>
          Selecciona tu rol para conocer los módulos disponibles, los pasos de cada tarea
          y los consejos para trabajar con mayor eficiencia.
        </Paragraph>
      </div>

      {/* ── Contenido principal ── */}
      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 20px' }}>

        {/* Tabs */}
        <Card
          style={{ borderRadius: 16, boxShadow: token.boxShadowSecondary, marginBottom: 24 }}
          styles={{ body: { padding: 0 } }}
        >
          <Tabs
            activeKey={rolActivo}
            onChange={(k) => setRolActivo(k as RolKey)}
            items={tabItems}
            size="large"
            style={{ padding: '0 24px' }}
            tabBarStyle={{ marginBottom: 0 }}
          />

          {/* Descripción del rol */}
          <div
            style={{
              background: rolInfo.bgColor,
              borderTop: `3px solid ${rolInfo.color}`,
              padding: '16px 28px',
            }}
          >
            <Space align="start" size={12}>
              <Tag
                color={rolInfo.color}
                style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, fontWeight: 700, marginTop: 3 }}
              >
                {rolInfo.label.toUpperCase()}
              </Tag>
              <Text style={{ fontSize: 14, color: token.colorTextSecondary }}>
                {rolInfo.descripcion}
              </Text>
            </Space>
          </div>

          {/* Grid de módulos con Collapse */}
          <div style={{ padding: '24px 20px 28px' }}>
            <Title level={5} style={{ marginTop: 0, marginBottom: 16, color: token.colorTextSecondary }}>
              Módulos disponibles — haz clic en cualquiera para ver los detalles
            </Title>
            <Row gutter={[16, 16]}>
              {rolInfo.modulos.map((m, i) => (
                <Col key={i} xs={24} sm={12} xl={8}>
                  <Collapse
                    ghost
                    style={{
                      background: '#fff',
                      border: `1px solid ${token.colorBorderSecondary}`,
                      borderRadius: 12,
                      overflow: 'hidden',
                    }}
                    items={[
                      {
                        key: String(i),
                        label: (
                          <Space size={10} align="start">
                            <span style={{ color: rolInfo.color, fontSize: 22, lineHeight: 1 }}>
                              {m.icono}
                            </span>
                            <div>
                              <Space size={6} align="center">
                                <Text strong style={{ fontSize: 14 }}>{m.titulo}</Text>
                                {m.soloRoles && (
                                  <LockOutlined
                                    style={{ fontSize: 11, color: token.colorTextTertiary }}
                                    title={`Solo ${m.soloRoles.join(' / ')}`}
                                  />
                                )}
                              </Space>
                              {m.ruta && (
                                <div>
                                  <Text style={{ fontSize: 11, color: token.colorTextQuaternary, fontFamily: 'monospace' }}>
                                    {m.ruta}
                                  </Text>
                                </div>
                              )}
                            </div>
                          </Space>
                        ),
                        children: (
                          <Space direction="vertical" size={14} style={{ width: '100%' }}>
                            <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.6 }}>
                              {m.descripcion}
                            </Text>

                            {/* Pasos */}
                            <div>
                              <Text
                                strong
                                style={{
                                  fontSize: 12,
                                  color: rolInfo.color,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em',
                                  display: 'block',
                                  marginBottom: 6,
                                }}
                              >
                                Pasos de uso
                              </Text>
                              <List
                                size="small"
                                dataSource={m.pasos}
                                renderItem={(paso, idx) => (
                                  <List.Item
                                    style={{
                                      padding: '4px 0',
                                      borderBottom: 'none',
                                      alignItems: 'flex-start',
                                    }}
                                  >
                                    <Space align="start" size={8}>
                                      <Badge
                                        count={idx + 1}
                                        style={{
                                          backgroundColor: rolInfo.color,
                                          fontSize: 10,
                                          minWidth: 18,
                                          height: 18,
                                          lineHeight: '18px',
                                          flexShrink: 0,
                                          marginTop: 2,
                                        }}
                                      />
                                      <Text style={{ fontSize: 13, lineHeight: 1.5 }}>{paso}</Text>
                                    </Space>
                                  </List.Item>
                                )}
                              />
                            </div>

                            {/* Acciones */}
                            <div>
                              <Text
                                strong
                                style={{
                                  fontSize: 12,
                                  color: rolInfo.color,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em',
                                  display: 'block',
                                  marginBottom: 6,
                                }}
                              >
                                Qué puedes hacer
                              </Text>
                              <List
                                size="small"
                                dataSource={m.acciones}
                                renderItem={(accion) => (
                                  <List.Item style={{ padding: '3px 0', borderBottom: 'none' }}>
                                    <Space size={6} align="start">
                                      <CheckCircleOutlined
                                        style={{ color: rolInfo.color, fontSize: 13, marginTop: 2, flexShrink: 0 }}
                                      />
                                      <Text style={{ fontSize: 13 }}>{accion}</Text>
                                    </Space>
                                  </List.Item>
                                )}
                              />
                            </div>

                            {/* Tip */}
                            <div
                              style={{
                                background: rolInfo.bgColor,
                                border: `1px solid ${rolInfo.color}30`,
                                borderRadius: 8,
                                padding: '10px 12px',
                              }}
                            >
                              <Space align="start" size={8}>
                                <BulbOutlined style={{ color: rolInfo.color, fontSize: 16, flexShrink: 0, marginTop: 1 }} />
                                <Text style={{ fontSize: 13, color: token.colorTextSecondary, lineHeight: 1.5 }}>
                                  <Text strong style={{ color: rolInfo.color }}>Consejo: </Text>
                                  {m.tip}
                                </Text>
                              </Space>
                            </div>

                            {m.ruta && (
                              <Button
                                size="small"
                                type="link"
                                icon={<RightOutlined />}
                                style={{ color: rolInfo.color, padding: 0, fontSize: 13 }}
                                onClick={() => navigate('/login')}
                              >
                                Inicia sesión para usar este módulo
                              </Button>
                            )}
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Col>
              ))}
            </Row>
          </div>
        </Card>

        {/* ── Flujo de turno ── */}
        <Divider style={{ margin: '8px 0 28px' }}>
          <Text strong style={{ fontSize: 15 }}>¿Cómo se complementan los roles?</Text>
        </Divider>

        <Card
          style={{ borderRadius: 16, marginBottom: 32, boxShadow: token.boxShadowTertiary }}
        >
          <Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: 24, fontSize: 14 }}>
            Cada rol es parte de un flujo continuo. Esta es la operación típica de un turno:
          </Paragraph>
          <Steps
            items={flujoSteps.map((s) => ({
              title: <Text strong>{s.title}</Text>,
              description: (
                <Text type="secondary" style={{ fontSize: 13 }}>{s.description}</Text>
              ),
              icon: (
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: token.colorPrimaryBg,
                    border: `2px solid ${token.colorPrimary}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: token.colorPrimary,
                    fontSize: 17,
                  }}
                >
                  {s.icon}
                </div>
              ),
            }))}
            responsive
          />
        </Card>

        {/* ── Credenciales demo ── */}
        <Card
          style={{
            borderRadius: 16,
            marginBottom: 40,
            background: token.colorPrimaryBg,
            border: `1px solid ${token.colorPrimaryBorder}`,
            textAlign: 'center',
          }}
        >
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Space align="center" size={10}>
              <UserOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
              <Title level={5} style={{ margin: 0, color: token.colorPrimary }}>
                Credenciales de demo
              </Title>
            </Space>
            <Row justify="center">
              <Col xs={24} sm={14} md={10}>
                <Card size="small" style={{ borderRadius: 10, textAlign: 'left' }} styles={{ body: { padding: 14 } }}>
                  <Tag color="purple" style={{ marginBottom: 8, fontWeight: 700 }}>ADMIN</Tag>
                  <div style={{ fontSize: 13 }}>
                    <Text type="secondary">Email: </Text>
                    <Text code style={{ fontSize: 12 }}>admin@minimarket.local</Text>
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    <Text type="secondary">Contraseña: </Text>
                    <Text code style={{ fontSize: 12 }}>Admin1234!</Text>
                  </div>
                </Card>
              </Col>
            </Row>
            <Text type="secondary" style={{ fontSize: 13 }}>
              El rol ADMIN tiene acceso total y puede crear usuarios con otros roles desde la plataforma.
            </Text>
          </Space>
        </Card>
      </div>

      {/* ── Footer CTA ── */}
      <div
        style={{
          background: '#fff',
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          padding: '22px 24px',
          textAlign: 'center',
        }}
      >
        <Space direction="vertical" size={10} align="center">
          <Text type="secondary">¿Ya tienes acceso a la plataforma?</Text>
          <Button
            type="primary"
            size="large"
            icon={<ShopOutlined />}
            onClick={() => navigate('/login')}
            style={{ minWidth: 200 }}
          >
            Iniciar sesión
          </Button>
        </Space>
      </div>
    </div>
  )
}

export default TutorialPage
