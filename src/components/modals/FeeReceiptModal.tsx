import React, { useState } from 'react';
import {
  X,
  Download,
  Printer,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  FileImage,
  Eye,
  ExternalLink,
  CreditCard
} from 'lucide-react';
import { StudentFee, Student } from '../../types';
import { generateInvoicePDF } from '../../utils/pdfGenerator';
import { getCurrencySymbol } from '../../utils/currency';

interface FeeReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  fee: StudentFee | null;
  student?: Student | null;
}

export const FeeReceiptModal: React.FC<FeeReceiptModalProps> = ({
  isOpen,
  onClose,
  fee,
  student
}) => {
  if (!isOpen || !fee) return null;

  const [isReceiptZoomOpen, setIsReceiptZoomOpen] = useState<boolean>(false);

  const academyName = 'IslamicTuition';
  const academyEmail = 'info@islamictuition.us';
  const academyWebsite = 'islamictuition.us';

  const isPaid = fee.status === 'Paid';
  const isSubmitted = fee.status === 'Payment Submitted';
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = !isPaid && !isSubmitted && fee.dueDate < today;

  const netAmount = Math.max(0, fee.amount - (fee.discount || 0));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div 
        id="official-fee-receipt-modal"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-[#E3DFD7] overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Top Control Bar */}
        <div className="px-6 py-3.5 bg-[#F7F5F1] border-b border-[#E3DFD7] flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#2D8B5C]" />
            <span className="text-xs font-bold text-[#161F1A]">Official Academy Fee Receipt</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={() => generateInvoicePDF(fee)}
              className="px-3 py-1.5 rounded-lg border border-[#D5D0C6] bg-white hover:bg-gray-50 text-xs font-semibold text-[#161F1A] flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Download official PDF invoice"
            >
              <Download className="w-3.5 h-3.5 text-[#2D8B5C]" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
              title="Print official receipt"
            >
              <Printer className="w-3.5 h-3.5 text-white" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[80vh] overflow-y-auto print:max-h-none print:overflow-visible">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b border-[#E3DFD7] pb-5 gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
                  <img
                    src="/favicon.png"
                    alt="IslamicTuition Favicon"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h2 className="text-lg font-bold text-[#161F1A]">{academyName}</h2>
              </div>
              <p className="text-xs text-[#5A6B61] mt-1">
                Online Quran classes for kids & Adults.
              </p>
              <p className="text-[11px] text-[#5A6B61]">
                {academyWebsite} • {academyEmail}
              </p>
            </div>

            <div className="sm:text-right">
              <span className="text-xs font-black tracking-wider text-[#2D8B5C] uppercase block">
                OFFICIAL TUITION RECEIPT
              </span>
              <p className="text-sm font-mono font-bold text-[#161F1A] mt-0.5">
                #{fee.invoiceNumber}
              </p>
              <p className="text-xs text-[#5A6B61] mt-0.5">
                Issue Date: {fee.createdAt?.slice(0, 10) || today}
              </p>
            </div>
          </div>

          {/* Student & Payment Summary Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#FAF9F7] p-4 rounded-xl border border-[#EAE6DE]">
            <div>
              <span className="text-[10px] font-bold tracking-wider text-[#5A6B61] uppercase block">
                BILLED TO:
              </span>
              <h3 className="text-sm font-bold text-[#161F1A] mt-0.5">
                {fee.parentName || fee.studentName}
              </h3>
              <p className="text-xs text-[#5A6B61]">
                Student: <strong className="text-[#161F1A]">{fee.studentName}</strong> ({fee.studentId})
              </p>
              <p className="text-xs text-[#5A6B61]">
                {fee.parentEmail ? `${fee.parentEmail} • ` : ''}
                IslamicTuition Portal.
              </p>
            </div>

            <div className="sm:text-right flex flex-col sm:items-end">
              <span className="text-[10px] font-bold tracking-wider text-[#5A6B61] uppercase block">
                PAYMENT STATUS:
              </span>
              <div className="mt-1">
                {isPaid ? (
                  <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-300">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>PAID</span>
                  </span>
                ) : isSubmitted ? (
                  <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-black bg-purple-50 text-purple-800 border border-purple-300">
                    <Clock className="w-3 h-3 text-purple-700" />
                    <span>PAYMENT SUBMITTED</span>
                  </span>
                ) : isOverdue ? (
                  <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-300">
                    <AlertCircle className="w-3 h-3" />
                    <span>OVERDUE</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-300">
                    <Clock className="w-3 h-3" />
                    <span>PENDING</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#5A6B61] mt-1.5 font-medium">
                {isPaid ? (
                  `Paid on: ${fee.paymentDate || fee.dueDate} via ${fee.paymentMethod || 'Bank Transfer'}`
                ) : isSubmitted ? (
                  `Notice submitted on: ${fee.paymentDate || 'Recently'} via ${fee.paymentMethod || 'Bank Transfer'} (Awaiting Admin Confirmation)`
                ) : (
                  `Awaiting settlement • Due: ${fee.dueDate}`
                )}
              </p>
            </div>
          </div>

          {/* Description & Item Table */}
          <div>
            <div className="grid grid-cols-12 text-xs font-bold text-[#5A6B61] pb-2.5 border-b border-[#E3DFD7]">
              <div className="col-span-7">Description</div>
              <div className="col-span-3">Period</div>
              <div className="col-span-2 text-right">Amount ({fee.currency})</div>
            </div>

            <div className="divide-y divide-[#EAE6DE]/60 text-xs">
              {fee.isFamilyInvoice && fee.siblingBreakdown && fee.siblingBreakdown.length > 0 ? (
                fee.siblingBreakdown.map((sib, index) => (
                  <div key={index} className="grid grid-cols-12 py-3 items-center">
                    <div className="col-span-7 pr-2">
                      <p className="font-bold text-[#161F1A]">Tuition: {sib.studentName}</p>
                      <p className="text-[11px] text-[#5A6B61]">
                        Student ID: {sib.studentId} • 1-on-1 Quran Nazra/Hifz/Tajweed instruction
                      </p>
                    </div>
                    <div className="col-span-3 font-medium text-[#161F1A]">
                      {fee.billingPeriod}
                    </div>
                    <div className="col-span-2 text-right font-mono font-bold text-[#161F1A]">
                      {getCurrencySymbol(fee.currency)}{sib.amount.toFixed(2)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="grid grid-cols-12 py-3 items-center">
                  <div className="col-span-7 pr-2">
                    <p className="font-bold text-[#161F1A]">Monthly Live Quran Tuition Classes</p>
                    <p className="text-[11px] text-[#5A6B61]">
                      1-on-1 personalized Quran Nazra/Hifz/Tajweed instruction
                    </p>
                  </div>
                  <div className="col-span-3 font-medium text-[#161F1A]">
                    {fee.billingPeriod}
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-[#161F1A]">
                    {getCurrencySymbol(fee.currency)}{fee.amount.toFixed(2)}
                  </div>
                </div>
              )}

              {/* Discount Row if applied */}
              {fee.discount && fee.discount > 0 ? (
                <div className="grid grid-cols-12 py-3 items-center bg-emerald-50/40 px-2 rounded-lg my-1">
                  <div className="col-span-7 pr-2">
                    <p className="font-bold text-emerald-800">
                      {fee.isFamilyInvoice ? 'Sibling Package Discount' : 'Family / Concession Discount'}
                    </p>
                    <p className="text-[11px] text-emerald-700/80">
                      {fee.notes || 'Academy promotional concession applied'}
                    </p>
                  </div>
                  <div className="col-span-3 text-emerald-700 font-medium">Applied</div>
                  <div className="col-span-2 text-right font-mono font-bold text-emerald-700">
                    -{getCurrencySymbol(fee.currency)}{fee.discount.toFixed(2)}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Total Payable Row */}
            <div className="border-t-2 border-[#1E5C3D] mt-4 pt-3.5 flex items-center justify-between">
              <span className="text-sm sm:text-base font-black text-[#161F1A]">Net Amount Payable:</span>
              <span className="text-base sm:text-xl font-black font-mono text-[#161F1A]">
                {getCurrencySymbol(fee.currency)}{netAmount.toFixed(2)} {fee.currency}
              </span>
            </div>
          </div>

          {/* Attached Proof of Payment / WebP Receipt Section */}
          {(fee.receiptImage || fee.paymentMtcnNumber || fee.paymentReference || fee.paymentProofNote || fee.adminConfirmedBy) && (
            <div className="bg-[#F8FAF8] border border-emerald-200/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#161F1A] flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-[#2D8B5C]" />
                  <span>Verified Payment Details & Remittance Proof</span>
                </span>
                {fee.receiptImage && (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-mono">
                    WebP Receipt Attached
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[11px] text-[#5A6B61] block">Payment Method:</span>
                  <p className="font-bold text-[#161F1A]">
                    {fee.paymentMethod || 'Bank Transfer'}
                  </p>
                </div>

                {fee.paymentMtcnNumber && (
                  <div>
                    <span className="text-[11px] text-[#5A6B61] block">MTCN / Transfer PIN:</span>
                    <p className="font-mono font-bold text-[#161F1A] tracking-wider">
                      {fee.paymentMtcnNumber}
                    </p>
                  </div>
                )}

                {fee.paymentSenderName && (
                  <div>
                    <span className="text-[11px] text-[#5A6B61] block">Remittance Sender Name:</span>
                    <p className="font-medium text-[#161F1A]">
                      {fee.paymentSenderName}
                    </p>
                  </div>
                )}

                {fee.paymentReference && (
                  <div>
                    <span className="text-[11px] text-[#5A6B61] block">Transaction Reference:</span>
                    <p className="font-mono text-[#161F1A]">
                      {fee.paymentReference}
                    </p>
                  </div>
                )}

                {fee.adminConfirmedBy && (
                  <div className="sm:col-span-2 bg-emerald-100/50 p-2.5 rounded-lg border border-emerald-200 text-emerald-900">
                    <span className="text-[11px] font-semibold block">Academy Verification:</span>
                    <p className="text-xs font-medium">
                      Officially verified & confirmed by <strong>{fee.adminConfirmedBy}</strong>
                      {fee.adminConfirmedAt ? ` on ${new Date(fee.adminConfirmedAt).toLocaleDateString()} at ${new Date(fee.adminConfirmedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}.
                    </p>
                  </div>
                )}
              </div>

              {/* WebP Receipt Image Thumbnail & Zoom */}
              {fee.receiptImage && (
                <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      onClick={() => setIsReceiptZoomOpen(true)}
                      className="relative w-12 h-12 rounded-lg bg-white border border-emerald-300 overflow-hidden shrink-0 cursor-pointer group shadow-2xs"
                      title="Click to zoom receipt"
                    >
                      <img
                        src={fee.receiptImage}
                        alt="Attached Receipt"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Eye className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#161F1A]">
                        {fee.receiptOriginalFileName || 'Payment_Slip_Receipt.webp'}
                      </p>
                      <span className="text-[11px] text-[#5A6B61]">
                        Compressed WebP • {fee.receiptCompressedSizeKB ? `${fee.receiptCompressedSizeKB} KB` : 'High Definition'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsReceiptZoomOpen(true)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-[#D5D0C6] hover:bg-gray-50 text-xs font-semibold text-[#161F1A] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#2D8B5C]" />
                    <span>View Receipt</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Footer Remarks & Stamp */}
          <div className="pt-4 border-t border-[#E3DFD7] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-[#161F1A]">
                JazakAllah Khair for being a valued part of {academyName}.
              </p>
              <p className="text-[11px] text-[#5A6B61] mt-0.5">
                May Allah bless the student with beneficial knowledge in Quran and Deen.
              </p>
            </div>

            <div className="sm:text-right">
              {isPaid ? (
                <div className="inline-block px-4 py-2 rounded-lg border-2 border-emerald-600 bg-emerald-50 text-emerald-800 font-mono font-black text-xs uppercase tracking-wider text-center">
                  PAID IN FULL
                </div>
              ) : isSubmitted ? (
                <div className="inline-block px-4 py-2 rounded-lg border-2 border-purple-600 bg-purple-50 text-purple-900 font-mono font-black text-xs uppercase tracking-wider text-center">
                  PAYMENT SUBMITTED (PENDING CONFIRMATION)
                </div>
              ) : isOverdue ? (
                <div className="inline-block px-4 py-2 rounded-lg border-2 border-rose-500 bg-rose-50 text-rose-700 font-mono font-black text-xs uppercase tracking-wider text-center">
                  OVERDUE PAYMENT
                </div>
              ) : (
                <div className="inline-block px-4 py-2 rounded-lg border-2 border-emerald-700/60 bg-white text-emerald-800 font-mono font-black text-xs uppercase tracking-wider text-center">
                  PENDING PAYMENT
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Full Screen / Zoom Modal */}
      {isReceiptZoomOpen && fee.receiptImage && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsReceiptZoomOpen(false)}
        >
          <div
            className="max-w-3xl w-full bg-white rounded-2xl p-4 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <span className="text-xs font-bold text-[#161F1A] flex items-center gap-1.5">
                <FileImage className="w-4 h-4 text-[#2D8B5C]" />
                <span>Payment Receipt Slip • {fee.studentName} ({fee.invoiceNumber})</span>
              </span>
              <button
                type="button"
                onClick={() => setIsReceiptZoomOpen(false)}
                className="p-1 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-3 max-h-[72vh] overflow-auto flex items-center justify-center bg-gray-50 rounded-lg p-2 border border-gray-100">
              <img
                src={fee.receiptImage}
                alt="Receipt Full Preview"
                className="max-h-[68vh] w-auto object-contain rounded-md shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
