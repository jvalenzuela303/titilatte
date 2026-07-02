# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 1.1.0 (2026-07-02)


### Features

* **branches:** endpoint público /config y boleta con datos reales de sucursal ([bdea688](https://github.com/jvalenzuela303/titilatte/commit/bdea688bbd0b0951a3ed20a946ade699acf8a4ac))
* **frontend:** agregar página pública de tutorial por roles ([771f3be](https://github.com/jvalenzuela303/titilatte/commit/771f3beb32fa5ae32523d44510d47659a550f7d8))
* **infra:** configuración deploy demo en demo.s3suite.cl ([be36be8](https://github.com/jvalenzuela303/titilatte/commit/be36be8ea047bda434e270b28bcc253adff350e4))
* módulo de pedidos especiales, abonos en compras y ventas a crédito ([3251332](https://github.com/jvalenzuela303/titilatte/commit/3251332e0ef640078e33e054bf4da6d458b4f494))
* **orders:** autocomplete de productos del catálogo en formulario de pedidos ([bff7d81](https://github.com/jvalenzuela303/titilatte/commit/bff7d813cd6bf6d7529ce9fbe4b6ff8592621113))
* **orders:** desglose de productos, entrega con hora y alertas SSE ([0c65731](https://github.com/jvalenzuela303/titilatte/commit/0c657314c904219a67629dd1df46c91c64925e98))
* **pos:** agregar modo precio libre para Pan de Casa ([d95bf4e](https://github.com/jvalenzuela303/titilatte/commit/d95bf4eecdf440e4e75b778fad76282dc0f6209e))
* **pos:** venta por peso, redondeo chileno y productos caseros ([133620b](https://github.com/jvalenzuela303/titilatte/commit/133620bb394904f0d1dea6fe8478629cbc3e0666))
* **reports+ux:** tab Por Categoría, desglose pagos y banners descriptivos en todas las páginas ([0609016](https://github.com/jvalenzuela303/titilatte/commit/0609016be915058bdb9858e663393cf163774d43))
* **reports:** agregar pestañas Pedidos y Créditos en reportes ([b4b7c64](https://github.com/jvalenzuela303/titilatte/commit/b4b7c64b03b9e4cb96cb877205af2627dd999506))
* **ui:** renombrar Fiados → Créditos en títulos y menú ([5136b6f](https://github.com/jvalenzuela303/titilatte/commit/5136b6f8d07665b533b16655edab6cfe95ce88a5))


### Bug Fixes

* **ci:** corregir parámetros inválidos que bloqueaban todos los deploys ([7ccd4d2](https://github.com/jvalenzuela303/titilatte/commit/7ccd4d270fe45208b472fbd27bec7ce7a3d47654)), closes [#4](https://github.com/jvalenzuela303/titilatte/issues/4)
* corregir advertencias detectadas en revisión Playwright ([c7957c9](https://github.com/jvalenzuela303/titilatte/commit/c7957c9080e7510d97d8b65e3c952a9fdbfcc39b))
* **dashboard:** agregar Tooltip faltante en imports de antd ([5a98533](https://github.com/jvalenzuela303/titilatte/commit/5a985338feda65044161fee52db1f30e662c77aa))
* **dashboard:** renombrar Tooltip de recharts para evitar colisión con antd ([4ed3b6a](https://github.com/jvalenzuela303/titilatte/commit/4ed3b6a5720cbfb98dae300e76d9f00e4c6f60de))
* **db:** deshabilitar open-in-view para evitar agotamiento del pool ([5bc509d](https://github.com/jvalenzuela303/titilatte/commit/5bc509d3b8935d0e50d83850abc60c920a9fbe91))
* **demo:** aumentar HikariCP pool de 10 a 20 conexiones ([8d6bbeb](https://github.com/jvalenzuela303/titilatte/commit/8d6bbeb70d0e374a866b2c0fb6479b1ba06ef782))
* **frontend:** corregir errores de TypeScript que bloqueaban el build de CD ([adc31a5](https://github.com/jvalenzuela303/titilatte/commit/adc31a5b8fa16d95d51c3a027dbb762c5cf064dd))
* **infra:** agregar red interna demo-net para habilitar port bindings ([581ec90](https://github.com/jvalenzuela303/titilatte/commit/581ec906703bb353b4699fe6370572d2712159ae))
* **infra:** corregir errores en deploy demo VPS ([9dd1dc0](https://github.com/jvalenzuela303/titilatte/commit/9dd1dc0c2a57eb9b92fa10e5b481fe7caeee93cb))
* **pos:** tratar productos LT y ML como venta por cantidad ([ecaebce](https://github.com/jvalenzuela303/titilatte/commit/ecaebced2cc2584f2d1c0865aff360d211e363bb))
* **products:** deshabilitar control de stock para pan de casa ([0669f30](https://github.com/jvalenzuela303/titilatte/commit/0669f30a81b57ac301161c759d283d2f01c8c6e2))
* **security:** exponer liveness y readiness probes sin autenticación ([c52ccbd](https://github.com/jvalenzuela303/titilatte/commit/c52ccbdecec84f9ea5b67bfa298c46dc8e6772bf))
* **seed:** corregir hash BCrypt del admin en V6 ([4321dfd](https://github.com/jvalenzuela303/titilatte/commit/4321dfd35209e8c2f7440fad175408860d7cd29d))
