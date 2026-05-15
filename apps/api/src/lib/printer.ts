/**
 * Thin re-export from the imprimantcloud npm package.
 * Installed via: npm install "git+https://github.com/tsirinarivo/ImprimantCloud.git#claude/add-french-support-dgA4o"
 *
 * Env required:
 *   APP_ENCRYPTION_KEY  — 64 chars hex
 *   XPYUN_DEBUG         — "1" debug / "0" prod
 */
export {
  getConfig,
  updateConfig,
  printNow,
  printTest,
  printerStatus,
  getLogs,
  refreshLogs,
  enrollPrinter,
  autoPrintSaleReceipt,
  printSaleReceiptNow,
  formatSaleReceipt,
  formatDeliveryNote,
  formatInventorySheet,
  formatCreditNote,
  formatMoney,
  sendPrintAndLog,
} from 'imprimantcloud'
