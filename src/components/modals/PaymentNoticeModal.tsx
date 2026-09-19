import React, { useState, useRef } from 'react';
import {
  X,
  Send,
  CreditCard,
  Building,
  CheckCircle2,
  Calendar,
  DollarSign,
  AlertCircle,
  UploadCloud,
  FileImage,
  Eye,
  Trash2,
  Sparkles,
  RefreshCw,
  Zap,
  Info
} from 'lucide-react';
import { StudentFee } from '../../types';
import { getCurrencySymbol } from '../../utils/currency';
import { updateFee } from '../../services/dataService';
import { compressReceiptToWebP, CompressedImageResult } from '../../utils/imageCompressor';

interface PaymentNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  fee: StudentFee | null;
  submitterRole: 'Parent' | 'Student';
  onPaymentSubmitted?: () => Promise<void> | void;
}

export const PAYMENT_METHODS = [
  // US & Digital Wallets
  { id: 'Zelle', name: 'Zelle (US Bank Instant Transfer)', category: 'Digital Wallet', isRemittance: false },
  { id: 'PayPal', name: 'PayPal (Balance / Card)', category: 'Digital Wallet', isRemittance: false },
  { id: 'Wise', name: 'Wise (TransferWise Multi-Currency)', category: 'Digital Wallet', isRemittance: false },
  
  // Cash Pick-up & Remittance Services (Popular for Quran Academies)
  { id: 'Western Union', name: 'Western Union (WU - Cash Pick-up / Bank)', category: 'Cash Remittance', isRemittance: true },
  { id: 'Ria Money Transfer', name: 'Ria Money Transfer (Cash Pick-up)', category: 'Cash Remittance', isRemittance: true },
  { id: 'MoneyGram', name: 'MoneyGram (Cash Pick-up / Bank)', category: 'Cash Remittance', isRemittance: true },
  { id: 'Remitly', name: 'Remitly (International Transfer)', category: 'Cash Remittance', isRemittance: true },
  { id: 'WorldRemit', name: 'WorldRemit (Remittance / Cash)', category: 'Cash Remittance', isRemittance: true },
  { id: 'Xoom', name: 'Xoom by PayPal (Cash Pick-up / Deposit)', category: 'Cash Remittance', isRemittance: true },

  // Bank & Direct
  { id: 'Bank Transfer', name: 'Direct Bank Transfer (IBAN / Wire / ACH)', category: 'Bank Wire', isRemittance: false },
  { id: 'Interac e-Transfer', name: 'Interac e-Transfer (Canada)', category: 'Bank Wire', isRemittance: false },
  { id: 'Cash Pick-up (Office)', name: 'Cash in Hand (Local Academy Representative)', category: 'Cash', isRemittance: false },
  { id: 'Other', name: 'Other Payment Method', category: 'Other', isRemittance: false }
] as const;

export const PaymentNoticeModal: React.FC<PaymentNoticeModalProps> = ({
  isOpen,
  onClose,
  fee,
  submitterRole,
  onPaymentSubmitted
}) => {
  if (!isOpen || !fee) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const [paymentDate, setPaymentDate] = useState<string>(fee.paymentDate || todayStr);
  const [paymentMethod, setPaymentMethod] = useState<string>(fee.paymentMethod || 'Zelle');
  const [reference, setReference] = useState<string>(fee.paymentReference || '');
  const [mtcnNumber, setMtcnNumber] = useState<string>(fee.paymentMtcnNumber || '');
  const [senderName, setSenderName] = useState<string>(fee.paymentSenderName || fee.parentName || '');
  const [notes, setNotes] = useState<string>(fee.paymentProofNote || '');
  
  // Receipt Image & Compression states
  const [receiptImage, setReceiptImage] = useState<string | null>(fee.receiptImage || null);
  const [receiptStats, setReceiptStats] = useState<{
    originalSizeKB: number;
    compressedSizeKB: number;
    reductionPercentage: number;
    fileName: string;
  } | null>(
    fee.receiptCompressedSizeKB
      ? {
          originalSizeKB: Math.round((fee.receiptCompressedSizeKB / (1 - (fee.receiptReductionPercent || 80) / 100))),
          compressedSizeKB: fee.receiptCompressedSizeKB,
          reductionPercentage: fee.receiptReductionPercent || 85,
          fileName: fee.receiptOriginalFileName || 'receipt.webp'
        }
      : null
  );
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [isPreviewZoomOpen, setIsPreviewZoomOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if current method is a remittance service requiring MTCN
  const selectedMethodObj = PAYMENT_METHODS.find(m => m.id === paymentMethod);
  const isCashRemittance = selectedMethodObj?.isRemittance || ['Western Union', 'Ria Money Transfer', 'MoneyGram', 'Remitly', 'WorldRemit', 'Xoom'].includes(paymentMethod);
  const isZelle = paymentMethod === 'Zelle';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setErrorMsg(null);
    setIsCompressing(true);
    try {
      const result: CompressedImageResult = await compressReceiptToWebP(file, 1280, 0.76);
      setReceiptImage(result.dataUrl);
      setReceiptStats({
        originalSizeKB: result.originalSizeKB,
        compressedSizeKB: result.compressedSizeKB,
        reductionPercentage: result.reductionPercentage,
        fileName: result.fileName
      });
    } catch (err: any) {
      console.error('Compression error:', err);
      setErrorMsg(err.message || 'Failed to compress receipt image.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptImage(null);
    setReceiptStats(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await updateFee(fee.id, {
        status: 'Payment Submitted',
        paymentDate: paymentDate || todayStr,
        paymentMethod: paymentMethod,
        paymentSubmittedAt: new Date().toISOString(),
        paymentSubmittedBy: submitterRole,
        paymentReference: reference.trim() || undefined,
        paymentMtcnNumber: isCashRemittance ? (mtcnNumber.trim() || undefined) : undefined,
        paymentSenderName: senderName.trim() || undefined,
        paymentRemittanceService: paymentMethod,
        paymentProofNote: notes.trim() || undefined,
        receiptImage: receiptImage || undefined,
        receiptOriginalFileName: receiptStats?.fileName || undefined,
        receiptCompressedSizeKB: receiptStats?.compressedSizeKB || undefined,
        receiptReductionPercent: receiptStats?.reductionPercentage || undefined
      });

      if (onPaymentSubmitted) {
        await onPaymentSubmitted();
      }

      onClose();
    } catch (err: any) {
      console.error('Error submitting payment notice:', err);
      setErrorMsg(err.message || 'Failed to submit payment notice. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-[#D5D0C6] flex flex-col my-6 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1E5C3D] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-white/10 text-emerald-200">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">Submit Tuition Payment Notice</h3>
              <p className="text-xs text-emerald-100/90">
                Notify Academy Administration • Zelle, Cash Pick-up, Bank & Receipt
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Summary Box */}
        <div className="bg-[#FAF9F7] px-5 py-3.5 border-b border-[#E8E4DC] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#8C5D08] uppercase tracking-wider block">
              {fee.isFamilyInvoice ? 'Family Consolidated Tuition' : 'Student Tuition Invoice'}
            </span>
            <h4 className="text-sm font-bold text-[#161F1A]">
              {fee.studentName}
            </h4>
            <span className="text-xs text-[#5A6B61] font-mono">
              Inv #{fee.invoiceNumber} • Period: {fee.billingPeriod}
            </span>
          </div>

          <div className="text-right">
            <span className="text-xs text-[#5A6B61] block">Net Payable</span>
            <span className="text-lg font-bold text-[#2D8B5C] font-mono">
              {getCurrencySymbol(fee.currency)}{fee.amount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="bg-[#EBF7F0] border border-[#2D8B5C]/20 rounded-xl p-3 text-xs text-[#1E5C3D] flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#2D8B5C] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Upon submitting, your invoice status updates to <strong>Payment Submitted</strong>. The academy administration will verify the deposit/remittance in their records and officially confirm it as <strong>Paid</strong>.
            </p>
          </div>

          {/* Payment Date & Method Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Date Payment Sent *
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-[#D5D0C6] rounded-lg bg-white text-[#161F1A] focus:outline-none focus:ring-2 focus:ring-[#2D8B5C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Payment Method Used *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-[#D5D0C6] rounded-lg bg-white text-[#161F1A] focus:outline-none focus:ring-2 focus:ring-[#2D8B5C] font-medium"
              >
                <optgroup label="🇺🇸 US & Digital Wallets">
                  <option value="Zelle">Zelle (US Bank Instant Transfer)</option>
                  <option value="PayPal">PayPal</option>
                  <option value="Wise">Wise (TransferWise)</option>
                </optgroup>
                <optgroup label="🌍 Cash Pick-up & Remittance Services">
                  <option value="Western Union">Western Union (WU Cash Pick-up)</option>
                  <option value="Ria Money Transfer">Ria Money Transfer (Cash Pick-up)</option>
                  <option value="MoneyGram">MoneyGram (Cash Pick-up)</option>
                  <option value="Remitly">Remitly</option>
                  <option value="WorldRemit">WorldRemit</option>
                  <option value="Xoom">Xoom (by PayPal)</option>
                </optgroup>
                <optgroup label="🏦 Direct Bank & Local">
                  <option value="Bank Transfer">Bank Transfer (IBAN / Wire / ACH)</option>
                  <option value="Interac e-Transfer">Interac e-Transfer (Canada)</option>
                  <option value="Cash Pick-up (Office)">Cash in Hand (Academy Representative)</option>
                  <option value="Other">Other Method</option>
                </optgroup>
              </select>
            </div>
          </div>

          {/* Conditional Cash Pick-up Fields (Western Union, Ria, MoneyGram, etc.) */}
          {isCashRemittance && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
                <Info className="w-4 h-4 text-amber-700 shrink-0" />
                <span>{paymentMethod} Cash Pick-up Remittance Details</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-normal">
                To collect or verify cash remittances, academy finance needs the exact <strong>MTCN / PIN Number</strong> and the <strong>Sender Name</strong> registered on the slip.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-amber-950 mb-1">
                    MTCN / PIN / Transfer Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10-digit MTCN (WU) or PIN (Ria)"
                    value={mtcnNumber}
                    onChange={(e) => setMtcnNumber(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-amber-300 rounded-lg bg-white text-[#161F1A] focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-950 mb-1">
                    Sender Full Name (as on ID) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fatima Zahra (Sender)"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-amber-300 rounded-lg bg-white text-[#161F1A] focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Conditional Zelle Information Field */}
          {isZelle && (
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center space-x-2 text-purple-900 font-bold text-xs">
                <Zap className="w-4 h-4 text-purple-700 shrink-0" />
                <span>Zelle Instant Transfer Details</span>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-purple-950 mb-1">
                  Zelle Sender Name / Phone / Email & Confirmation #
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sent from Jane Doe (555-0199) • Conf #ZEL-92819"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-purple-300 rounded-lg bg-white text-[#161F1A] focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}

          {/* Standard Transaction Reference (if not Zelle or Remittance) */}
          {!isCashRemittance && !isZelle && (
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                Transaction Reference / Bank Details (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Sent from Barclays ending 4821 or PayPal transaction ID..."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-[#D5D0C6] rounded-lg bg-white text-[#161F1A] focus:outline-none focus:ring-2 focus:ring-[#2D8B5C]"
              />
              <span className="text-[11px] text-[#5A6B61] mt-0.5 block">
                Helps academy finance match the transfer to your student account quickly.
              </span>
            </div>
          )}

          {/* Ultra-Optimized WebP Receipt Upload */}
          <div className="border border-[#D5D0C6] rounded-xl p-3.5 bg-[#FAF9F7]">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#161F1A] flex items-center gap-1.5">
                <FileImage className="w-4 h-4 text-[#2D8B5C]" />
                <span>Proof of Payment / Transfer Receipt</span>
                <span className="text-[10px] font-normal text-[#5A6B61]">(Optional photo or screenshot)</span>
              </label>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Auto-WebP Compressed
              </span>
            </div>

            {/* Hidden native input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {receiptImage ? (
              <div className="bg-white rounded-lg border border-[#D5D0C6] p-3 flex items-center justify-between gap-3">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div
                    onClick={() => setIsPreviewZoomOpen(true)}
                    className="relative w-14 h-14 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0 cursor-pointer group"
                    title="Click to zoom receipt"
                  >
                    <img
                      src={receiptImage}
                      alt="Receipt WebP preview"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <Eye className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#161F1A] truncate">
                      {receiptStats?.fileName || 'Payment_Receipt.webp'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-mono font-bold text-[#2D8B5C] bg-emerald-50 px-1.5 py-0.5 rounded">
                        WebP • {receiptStats?.compressedSizeKB || '42'} KB
                      </span>
                      {receiptStats?.reductionPercentage ? (
                        <span className="text-[11px] text-[#5A6B61]">
                          ({receiptStats.reductionPercentage}% smaller)
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      Zero server bloat • Embeds safely in invoice
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsPreviewZoomOpen(true)}
                    className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
                    title="Zoom receipt"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
                    title="Replace with another receipt image"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveReceipt}
                    className="p-1.5 rounded-md hover:bg-red-50 text-red-600 transition-colors cursor-pointer"
                    title="Remove receipt"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#D5D0C6] hover:border-[#2D8B5C] bg-white hover:bg-emerald-50/20 rounded-xl p-4 text-center cursor-pointer transition-colors"
              >
                {isCompressing ? (
                  <div className="flex flex-col items-center justify-center py-2 space-y-2">
                    <RefreshCw className="w-6 h-6 text-[#2D8B5C] animate-spin" />
                    <span className="text-xs font-semibold text-[#161F1A]">
                      Optimizing and converting image to compressed WebP...
                    </span>
                    <span className="text-[10px] text-[#5A6B61]">
                      Keeps page lightning fast & Firestore memory tiny
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <div className="w-9 h-9 rounded-full bg-emerald-50 text-[#2D8B5C] flex items-center justify-center">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-[#161F1A]">
                      Click to upload receipt photo or drag & drop
                    </span>
                    <p className="text-[11px] text-[#5A6B61]">
                      PNG, JPG, or Screenshot • Automatically compressed to lightweight WebP (&lt;60KB)
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#161F1A] mb-1">
              Notes for Academy Administration (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Paid via Zelle from Brother Ahmad's account, or Western Union picked up by Ustadh..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-[#D5D0C6] rounded-lg bg-white text-[#161F1A] focus:outline-none focus:ring-2 focus:ring-[#2D8B5C] resize-none"
            />
          </div>

          {/* Submit / Cancel Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-[#E8E4DC]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isCompressing}
              className="px-4 py-2 text-xs font-bold text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded-lg transition-colors flex items-center space-x-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Sending Notice...' : 'Submit Payment Notice'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Image Zoom Modal */}
      {isPreviewZoomOpen && receiptImage && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsPreviewZoomOpen(false)}
        >
          <div
            className="max-w-3xl w-full bg-white rounded-2xl p-4 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <span className="text-xs font-bold text-[#161F1A] flex items-center gap-1.5">
                <FileImage className="w-4 h-4 text-[#2D8B5C]" />
                <span>Receipt Preview • WebP Compressed</span>
              </span>
              <button
                type="button"
                onClick={() => setIsPreviewZoomOpen(false)}
                className="p-1 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-3 max-h-[70vh] overflow-auto flex items-center justify-center bg-gray-50 rounded-lg p-2 border border-gray-100">
              <img
                src={receiptImage}
                alt="Receipt Full Preview"
                className="max-h-[65vh] w-auto object-contain rounded-md shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
