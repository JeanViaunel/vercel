"use client";
import { useState, useEffect } from "react";
import { ArrowUpDown, RefreshCcw, Download, Eye } from "lucide-react";
import {
  CURRENCIES,
  FALLBACK_RATES,
  formatCurrency,
  calculateFee,
} from "./utils/currency-utils";
import { generatePdf } from "./utils/pdf-generator";
import PdfPreview from "./components/PdfPreview";

const CurrencyTransfer = () => {
  // State Management
  const [amount, setAmount] = useState("");
  const [fromCurrency, setFromCurrency] = useState("TWD");
  const [toCurrency, setToCurrency] = useState("USD");
  const [accountType, setAccountType] = useState("standard");
  const [rates, setRates] = useState(FALLBACK_RATES);
  const [lastUpdated, setLastUpdated] = useState("--");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ message: "", type: "" });
  const [computedResult, setComputedResult] = useState(null);
  const [quickAmounts] = useState(["$10", "$50", "$100", "$500"]);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [isJsPdfLoaded, setIsJsPdfLoaded] = useState(false);

  // Load jsPDF on mount
  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.async = true;
    script.onload = () => setIsJsPdfLoaded(true);
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Fetch exchange rates on mount
  useEffect(() => {
    fetchExchangeRates();
  }, []);

  // Recalculate when inputs change
  useEffect(() => {
    calculateTransfer();
  }, [amount, fromCurrency, toCurrency, accountType, rates]);

  const showAlert = (message, type) => {
    setAlert({ message, type });
    setTimeout(() => setAlert({ message: "", type: "" }), 5000);
  };

  const fetchExchangeRates = async () => {
    setLoading(true);
    setAlert({ message: "", type: "" });

    try {
      const response = await fetch(
        "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json"
      );
      if (!response.ok) throw new Error("Failed to fetch rates");

      const data = await response.json();
      const eurRates = data.eur;
      const usdRate = 1 / eurRates.usd;

      const newRates = {
        HTG: 130, // Fixed rate for HTG
        USD: 1,
        EUR: usdRate,
        TWD: eurRates.twd * usdRate,
        GBP: eurRates.gbp * usdRate,
        JPY: eurRates.jpy * usdRate,
        AUD: eurRates.aud * usdRate,
        CAD: eurRates.cad * usdRate,
        CHF: eurRates.chf * usdRate,
        CNY: eurRates.cny * usdRate,
      };

      // Apply rate adjustment
      for (const key in newRates) {
        if (key !== "HTG") {
          newRates[key] = newRates[key] * 1.0171;
        }
      }

      setRates(newRates);
      setLastUpdated(data.date || new Date().toLocaleTimeString());
      showAlert("Live rates updated.", "success");
    } catch (error) {
      console.warn("API failed, using fallback rates:", error);
      setRates(FALLBACK_RATES);
      showAlert(
        "Live rates temporarily unavailable. Using fallback rates.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const calculateTransfer = () => {
    setAlert({ message: "", type: "" });

    if (!amount) {
      setComputedResult(null);
      return;
    }

    const amountVal = parseFloat(amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      showAlert("Please enter a valid amount.", "error");
      setComputedResult(null);
      return;
    }

    // Convert to USD for fee calculation
    const amountInUSD =
      fromCurrency === "USD" ? amountVal : amountVal / rates[fromCurrency];

    if (amountInUSD > 800) {
      showAlert(
        "For amounts greater than $800, please contact us for a custom quote.",
        "error"
      );
      setComputedResult(null);
      return;
    }

    // Calculate fees
    const baseFee = calculateFee(amountInUSD);
    const vipDiscount = accountType === "vip" ? baseFee * 0.25 : 0;
    const finalFee = baseFee - vipDiscount;

    // Convert to target currency
    const feeInTarget =
      toCurrency === "USD" ? finalFee : finalFee * rates[toCurrency];
    const convertedAmount =
      toCurrency === "USD" ? amountInUSD : amountInUSD * rates[toCurrency];

    setComputedResult({
      originalAmount: amountVal,
      convertedAmount,
      baseFee: feeInTarget,
      vipDiscount: vipDiscount * rates[toCurrency],
      finalFee: feeInTarget,
      netAmount: convertedAmount - feeInTarget,
      rate: rates[toCurrency] / rates[fromCurrency],
    });
  };

  const handleQuickAmount = (value) => {
    setAmount(value.replace("$", ""));
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const getPdfData = () => {
    if (!computedResult) return null;

    return {
      fromCurrency,
      toCurrency,
      transferAmount: formatCurrency(
        computedResult.originalAmount,
        fromCurrency
      ),
      baseFee: formatCurrency(computedResult.baseFee, toCurrency),
      vipDiscount: formatCurrency(computedResult.vipDiscount, toCurrency),
      finalFee: formatCurrency(computedResult.finalFee, toCurrency),
      netAmount: formatCurrency(computedResult.netAmount, toCurrency),
      rate: computedResult.rate.toFixed(4),
      isVip: accountType === "vip",
    };
  };

  const handlePreviewClick = () => {
    if (!computedResult) {
      showAlert("No summary available to preview.", "error");
      return;
    }
    if (!isJsPdfLoaded) {
      showAlert("Please wait while we load the PDF generator...", "error");
      return;
    }
    setShowPdfPreview(true);
  };

  const handleDownloadPdf = () => {
    if (!computedResult) {
      showAlert("No summary available to generate PDF.", "error");
      return;
    }
    if (!isJsPdfLoaded) {
      showAlert("Please wait while we load the PDF generator...", "error");
      return;
    }

    const pdfData = getPdfData();
    if (!pdfData) return;

    const doc = generatePdf(pdfData);
    doc.save("transfer_summary.pdf");
    setShowPdfPreview(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen flex-col text-slate-400">
        <div className="animate-spin w-12 h-12 mb-4">
          <RefreshCcw className="w-full h-full text-emerald-500" />
        </div>
        <p>Loading exchange rates...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50">
      {/* Navbar */}
      <nav className="bg-slate-800 px-8 py-4 border-b border-slate-700">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-2xl font-semibold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Currency Transfer
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <a
              href="#"
              className="text-slate-400 hover:text-cyan-400 transition-colors"
            >
              Home
            </a>
            <a
              href="#"
              className="text-slate-400 hover:text-cyan-400 transition-colors"
            >
              Features
            </a>
            <a
              href="#"
              className="text-slate-400 hover:text-cyan-400 transition-colors"
            >
              Pricing
            </a>
            <a
              href="#"
              className="text-slate-400 hover:text-cyan-400 transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="max-w-lg mx-auto mt-8 p-6 bg-slate-800/90 backdrop-blur-lg rounded-3xl border border-slate-700 shadow-xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 bg-cyan-400 opacity-20 rounded-full blur-lg" />
            <div className="relative bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full p-3 text-white">
              $
            </div>
          </div>
          <h1 className="text-3xl font-semibold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">
            Currency Transfer
          </h1>
          <p className="text-sm text-slate-400">Live exchange rates</p>
          <div className="flex items-center justify-center gap-2 mt-2 text-xs text-slate-400">
            <span>Last updated: {lastUpdated}</span>
            <button
              onClick={fetchExchangeRates}
              className="underline hover:text-cyan-400 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Alert */}
        {alert.message && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              alert.type === "error"
                ? "bg-red-500/10 border border-red-500/30 text-red-500"
                : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-500"
            }`}
          >
            {alert.message}
          </div>
        )}

        {/* Amount Input */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm text-slate-400">You Send</label>
            <span className="text-xs text-slate-400">
              {fromCurrency === "USD" && toCurrency === "TWD"
                ? `Rate: 1 USD = ${rates["TWD"].toFixed(4)} TWD`
                : computedResult
                ? `Rate: 1 ${fromCurrency} = ${computedResult.rate.toFixed(
                    4
                  )} ${toCurrency}`
                : ""}
            </span>
          </div>
          <div className="flex gap-3">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="any"
              className="flex-1 bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-3 text-slate-50"
            />
            <select
              value={fromCurrency}
              onChange={(e) => setFromCurrency(e.target.value)}
              className="bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-3 text-slate-50"
            >
              {CURRENCIES.map((curr) => (
                <option key={curr.code} value={curr.code}>
                  {curr.flag} {curr.code}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 mt-3">
            {quickAmounts.map((value, index) => (
              <button
                key={index}
                onClick={() => handleQuickAmount(value)}
                className="flex-1 bg-slate-900/70 py-2 rounded-md text-sm text-slate-400 hover:text-cyan-400 transition-colors"
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {/* Swap Button */}
        <button
          onClick={swapCurrencies}
          className="mx-auto block p-2 hover:text-cyan-400 transition-colors"
          title="Swap Currencies"
        >
          <ArrowUpDown className="w-5 h-5" />
        </button>

        {/* Receive Amount */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm text-slate-400">They Receive</label>
            <span
              className="text-xs text-slate-400"
              title="Amount after fees and conversion"
            >
              ℹ️
            </span>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-3 text-slate-50">
              {computedResult
                ? formatCurrency(computedResult.netAmount, toCurrency)
                : "0.00"}
            </div>
            <select
              value={toCurrency}
              onChange={(e) => setToCurrency(e.target.value)}
              className="bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-3 text-slate-50"
            >
              {CURRENCIES.map((curr) => (
                <option key={curr.code} value={curr.code}>
                  {curr.flag} {curr.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Account Type */}
        <div className="mb-6 relative">
          <label className="text-sm text-slate-400 block mb-2">
            Account Type
          </label>
          <select
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
            className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-3 text-slate-50"
          >
            <option value="standard">Standard Account</option>
            <option value="vip">VIP Account</option>
          </select>
          {accountType === "vip" && (
            <span className="absolute right-4 top-1/2 transform translate-y-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-medium px-3 py-1 rounded-full">
              VIP 25% OFF
            </span>
          )}
        </div>

        {/* Summary */}
        {computedResult && (
          <div className="bg-slate-900/70 rounded-lg p-6 mb-6">
            <div className="flex justify-between py-2 border-b border-slate-700">
              <span className="text-slate-400">Transfer Amount</span>
              <span className="font-medium">
                {formatCurrency(computedResult.originalAmount, fromCurrency)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-700">
              <span className="text-slate-400">Base Fee</span>
              <span className="font-medium">
                {formatCurrency(computedResult.baseFee, toCurrency)}
              </span>
            </div>
            {accountType === "vip" && (
              <div className="flex justify-between py-2 border-b border-slate-700">
                <span className="text-slate-400">VIP Discount</span>
                <span className="font-medium text-amber-500">
                  -{formatCurrency(computedResult.vipDiscount, toCurrency)}
                </span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-slate-700">
              <span className="text-slate-400">Final Fee</span>
              <span className="font-medium">
                {formatCurrency(computedResult.finalFee, toCurrency)}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">You'll Receive</span>
              <span className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                {formatCurrency(computedResult.netAmount, toCurrency)}
              </span>
            </div>
          </div>
        )}

        {/* Preview and Download Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handlePreviewClick}
            className={`flex-1 py-4 px-6 rounded-lg border border-emerald-500 text-emerald-500
              hover:bg-emerald-500/10 transition-colors font-semibold
              ${!computedResult && "opacity-50 cursor-not-allowed"}`}
            disabled={!computedResult}
          >
            <div className="flex items-center justify-center gap-2">
              <Eye className="w-5 h-5" />
              Preview
            </div>
          </button>

          <button
            onClick={handleDownloadPdf}
            className={`flex-1 py-4 px-6 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 
              text-white font-semibold hover:translate-y-[-2px] transition-transform
              ${!computedResult && "opacity-50 cursor-not-allowed"}`}
            disabled={!computedResult}
          >
            <div className="flex items-center justify-center gap-2">
              <Download className="w-5 h-5" />
              Download PDF
            </div>
          </button>
        </div>
      </div>

      {/* PDF Preview Modal */}
      <PdfPreview
        isOpen={showPdfPreview}
        onClose={() => setShowPdfPreview(false)}
        data={getPdfData()}
        onDownload={handleDownloadPdf}
      />
    </div>
  );
};

export default CurrencyTransfer;
