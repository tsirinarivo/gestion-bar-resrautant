/**
 * Thin wrapper around `imprimantcloud`.
 * If the package isn't installed yet, every function throws a clear error
 * instead of crashing the whole API at startup.
 *
 * Install: npm install imprimantcloud --workspace=apps/api
 * (requires the package to be accessible — private registry or local tarball)
 */

function mod(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('imprimantcloud')
  } catch {
    throw new Error(
      'imprimantcloud n\'est pas installé. ' +
      'Exécutez: npm install imprimantcloud --workspace=apps/api'
    )
  }
}

export const getConfig              = (...args: any[]) => mod().getConfig(...args)
export const updateConfig           = (...args: any[]) => mod().updateConfig(...args)
export const printNow               = (...args: any[]) => mod().printNow(...args)
export const printTest              = (...args: any[]) => mod().printTest(...args)
export const printerStatus          = (...args: any[]) => mod().printerStatus(...args)
export const getLogs                = (...args: any[]) => mod().getLogs(...args)
export const refreshLogs            = (...args: any[]) => mod().refreshLogs(...args)
export const enrollPrinter          = (...args: any[]) => mod().enrollPrinter(...args)
export const autoPrintSaleReceipt   = (...args: any[]) => mod().autoPrintSaleReceipt(...args)
export const printSaleReceiptNow    = (...args: any[]) => mod().printSaleReceiptNow(...args)
export const formatSaleReceipt      = (...args: any[]) => mod().formatSaleReceipt(...args)
export const formatDeliveryNote     = (...args: any[]) => mod().formatDeliveryNote(...args)
export const sendPrintAndLog        = (...args: any[]) => mod().sendPrintAndLog(...args)
