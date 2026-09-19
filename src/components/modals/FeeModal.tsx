import React, { useState, useEffect } from 'react';
import { X, DollarSign, CheckCircle, Users, Tag, Calculator } from 'lucide-react';
import { StudentFee, Student, Currency, FeeStatus, SiblingFeeItem } from '../../types';
import { ALLOWED_CURRENCIES, getCurrencySymbol } from '../../utils/currency';

interface FeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (feeData: Omit<StudentFee, 'id'>, id?: string) => Promise<void>;
  students: Student[];
  initialFee?: StudentFee | null;
}

export const FeeModal: React.FC<FeeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  students,
  initialFee
}) => {
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [isFamilyInvoice, setIsFamilyInvoice] = useState<boolean>(false);
  const [selectedFamilyGroup, setSelectedFamilyGroup] = useState<string>('');
  const [selectedSiblingIds, setSelectedSiblingIds] = useState<string[]>([]);
  const [studentId, setStudentId] = useState<string>('');
  const [amount, setAmount] = useState<number>(100);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [billingPeriod, setBillingPeriod] = useState<string>('September 2026');
  const [dueDate, setDueDate] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [status, setStatus] = useState<FeeStatus>('Pending');
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Bank Transfer');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Extract distinct family groups from students
  const familyGroups = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; students: Student[] }>();
    students.forEach(st => {
      if (st.familyGroupName || st.familyGroupId) {
        const key = st.familyGroupId || st.familyGroupName || '';
        const name = st.familyGroupName || 'Family Group';
        if (!map.has(key)) {
          map.set(key, { id: key, name, students: [] });
        }
        map.get(key)!.students.push(st);
      }
    });
    return Array.from(map.values());
  }, [students]);

  useEffect(() => {
    if (initialFee) {
      setInvoiceNumber(initialFee.invoiceNumber);
      setIsFamilyInvoice(Boolean(initialFee.isFamilyInvoice));
      setSelectedFamilyGroup(initialFee.familyGroupId || initialFee.familyGroupName || '');
      setSelectedSiblingIds(initialFee.studentIds || (initialFee.studentId ? [initialFee.studentId] : []));
      setStudentId(initialFee.studentId);
      setAmount(initialFee.amount);
      setCurrency(initialFee.currency);
      setBillingPeriod(initialFee.billingPeriod);
      setDueDate(initialFee.dueDate);
      setPaymentDate(initialFee.paymentDate || '');
      setStatus(initialFee.status);
      setDiscount(initialFee.discount || 0);
      setPaymentMethod(initialFee.paymentMethod || 'Bank Transfer');
      setNotes(initialFee.notes || '');
    } else {
      setInvoiceNumber(`INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
      setIsFamilyInvoice(false);
      setSelectedFamilyGroup('');
      setSelectedSiblingIds([]);
      const defaultStudent = students.length > 0 ? students[0] : null;
      if (defaultStudent) {
        setStudentId(defaultStudent.studentId);
        setAmount(defaultStudent.monthlyFee || 100);
        setCurrency((defaultStudent.feeCurrency as Currency) || 'USD');
      } else {
        setAmount(100);
        setCurrency('USD');
      }
      setBillingPeriod('September 2026');
      const d = new Date();
      d.setDate(d.getDate() + 10);
      setDueDate(d.toISOString().slice(0, 10));
      setPaymentDate('');
      setStatus('Pending');
      setDiscount(0);
      setPaymentMethod('Bank Transfer');
      setNotes('');
    }
  }, [initialFee, students]);

  // Handle selecting a family group
  const handleFamilyGroupChange = (groupIdOrName: string) => {
    setSelectedFamilyGroup(groupIdOrName);
    const grp = familyGroups.find(g => g.id === groupIdOrName || g.name === groupIdOrName);
    if (grp) {
      const sids = grp.students.map(s => s.studentId);
      setSelectedSiblingIds(sids);
      recalculateFamilyAggregate(sids, grp.name);
    }
  };

  // Recalculate aggregate tuition fee across selected siblings
  const recalculateFamilyAggregate = (sids: string[], groupName?: string) => {
    const selected = students.filter(s => sids.includes(s.studentId));
    const total = selected.reduce((sum, s) => sum + (s.monthlyFee || 100), 0);
    
    // Pick dominant currency
    const curr = (selected[0]?.feeCurrency as Currency) || 'USD';
    setCurrency(curr);
    setAmount(total);

    // Sibling discount rate configured by Admin in Academy Settings (default 10%)
    const savedRate = localStorage.getItem('it_sibling_discount_percent');
    const discountPercent = savedRate !== null ? (parseFloat(savedRate) || 0) : 10;
    const discountRate = discountPercent / 100;
    let siblingDiscount = 0;
    if (selected.length >= 2) {
      siblingDiscount = Math.round(total * discountRate);
      setDiscount(siblingDiscount);
    }

    const familyLabel = groupName || selectedFamilyGroup || (selected[0]?.parentName ? `The ${selected[0].parentName} Family` : 'Family');
    const breakdownNames = selected.map(s => `${s.name} (${getCurrencySymbol(curr)}${s.monthlyFee || 100})`).join(', ');
    setNotes(`Family Combined Invoice for ${familyLabel}. Attached: ${breakdownNames}. Sibling discount (${discountPercent}%): ${getCurrencySymbol(curr)}${siblingDiscount}.`);
  };

  const handleToggleSibling = (sid: string) => {
    const updated = selectedSiblingIds.includes(sid)
      ? selectedSiblingIds.filter(id => id !== sid)
      : [...selectedSiblingIds, sid];
    setSelectedSiblingIds(updated);
    recalculateFamilyAggregate(updated);
  };

  if (!isOpen) return null;

  const selectedStudent = students.find(s => s.studentId === studentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isFamilyInvoice) {
        if (selectedSiblingIds.length === 0) {
          alert('Please select at least one student for the Family Combined Invoice.');
          setSaving(false);
          return;
        }

        const attachedStudents = students.filter(s => selectedSiblingIds.includes(s.studentId));
        const matchedGroup = familyGroups.find(g => g.id === selectedFamilyGroup || g.name === selectedFamilyGroup);
        const resolvedFamilyName = matchedGroup?.name || selectedFamilyGroup || (attachedStudents[0]?.parentName ? `The ${attachedStudents[0].parentName} Family` : 'Family Group');
        const representativeId = attachedStudents[0]?.studentId || 'FAM-001';
        const parentName = attachedStudents[0]?.parentName || resolvedFamilyName;

        const breakdown: SiblingFeeItem[] = attachedStudents.map(s => ({
          studentId: s.studentId,
          studentName: s.name,
          amount: s.monthlyFee || (amount / attachedStudents.length)
        }));

        await onSave(
          {
            invoiceNumber,
            studentId: representativeId,
            studentName: `${resolvedFamilyName} (Combined Invoice)`,
            parentName,
            amount,
            currency,
            billingPeriod,
            dueDate,
            paymentDate: status === 'Paid' ? (paymentDate || new Date().toISOString().slice(0, 10)) : undefined,
            status,
            discount,
            isFamilyInvoice: true,
            familyGroupId: matchedGroup?.id || selectedFamilyGroup || 'family_group',
            familyGroupName: resolvedFamilyName,
            studentIds: selectedSiblingIds,
            siblingBreakdown: breakdown,
            paymentMethod: status === 'Paid' ? paymentMethod : undefined,
            notes,
            createdAt: initialFee?.createdAt || new Date().toISOString()
          },
          initialFee?.id
        );
      } else {
        await onSave(
          {
            invoiceNumber,
            studentId,
            studentName: selectedStudent?.name || 'Student',
            parentName: selectedStudent?.parentName || 'Parent',
            amount,
            currency,
            billingPeriod,
            dueDate,
            paymentDate: status === 'Paid' ? (paymentDate || new Date().toISOString().slice(0, 10)) : undefined,
            status,
            discount,
            isFamilyInvoice: false,
            studentIds: [studentId],
            paymentMethod: status === 'Paid' ? paymentMethod : undefined,
            notes,
            createdAt: initialFee?.createdAt || new Date().toISOString()
          },
          initialFee?.id
        );
      }
      onClose();
    } catch (err: any) {
      alert("Error saving fee: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl border border-[#E3DFD7] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#2D8B5C] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <span className="p-1.5 rounded-lg bg-white/10">
              <DollarSign className="w-5 h-5 text-[#E8A93E]" />
            </span>
            <div>
              <h3 className="font-bold text-base">
                {initialFee ? 'Edit Tuition Invoice' : 'Create Tuition Invoice'}
              </h3>
              <p className="text-xs text-[#d2e8dd]">
                {isFamilyInvoice ? 'Family Combined Sibling Invoicing' : 'Single Student Billing'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Family Combined Invoice Toggle */}
          <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className={`p-2 rounded-lg ${isFamilyInvoice ? 'bg-[#2D8B5C] text-white' : 'bg-gray-200 text-gray-600'}`}>
                <Users className="w-4 h-4" />
              </span>
              <div>
                <label htmlFor="is_family_combined_toggle" className="text-xs font-bold text-[#161F1A] block cursor-pointer">
                  Is Family Combined Invoice
                </label>
                <p className="text-[11px] text-[#5A6B61]">
                  Aggregate tuition across multiple children with automatic sibling discounts
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="is_family_combined_toggle"
                type="checkbox"
                checked={isFamilyInvoice}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsFamilyInvoice(checked);
                  if (checked) {
                    if (familyGroups.length > 0) {
                      handleFamilyGroupChange(familyGroups[0].id);
                    }
                  } else {
                    const st = students.find(s => s.studentId === studentId) || students[0];
                    if (st) {
                      setStudentId(st.studentId);
                      setAmount(st.monthlyFee || 100);
                      setCurrency((st.feeCurrency as Currency) || 'USD');
                    }
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2D8B5C]"></div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Invoice Number</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs font-mono font-bold bg-[#FAF9F7]"
                required
              />
            </div>

            {!isFamilyInvoice ? (
              <div>
                <label className="block text-xs font-semibold text-[#161F1A] mb-1">Student</label>
                <select
                  value={studentId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setStudentId(newId);
                    const st = students.find(s => s.studentId === newId);
                    if (st?.monthlyFee) setAmount(st.monthlyFee);
                    if (st?.feeCurrency) setCurrency(st.feeCurrency as Currency);
                  }}
                  className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white font-medium"
                  required
                >
                  {students.map(s => (
                    <option key={s.id} value={s.studentId}>
                      {s.name} ({s.studentId}){s.monthlyFee ? ` - ${getCurrencySymbol(s.feeCurrency)}${s.monthlyFee}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-[#161F1A] mb-1">Select Family Group</label>
                <select
                  value={selectedFamilyGroup}
                  onChange={(e) => handleFamilyGroupChange(e.target.value)}
                  className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white font-semibold text-[#1E5C3D]"
                >
                  <option value="">-- Choose Family Group --</option>
                  {familyGroups.map(fg => (
                    <option key={fg.id} value={fg.id}>
                      {fg.name} ({fg.students.length} children)
                    </option>
                  ))}
                  <option value="custom">Custom Sibling Group</option>
                </select>
              </div>
            )}
          </div>

          {/* Sibling multi-select when in Family Combined mode */}
          {isFamilyInvoice && (
            <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1E5C3D] flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#2D8B5C]" />
                  Attach Sibling Children ({selectedSiblingIds.length} attached)
                </span>
                <button
                  type="button"
                  onClick={() => recalculateFamilyAggregate(selectedSiblingIds)}
                  className="text-[11px] font-semibold text-[#2D8B5C] hover:underline flex items-center gap-1"
                >
                  <Calculator className="w-3 h-3" />
                  Auto-Compute Aggregate
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1.5 bg-white rounded-lg border border-emerald-100">
                {students.map(st => {
                  const isAttached = selectedSiblingIds.includes(st.studentId);
                  return (
                    <label
                      key={st.studentId}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer ${
                        isAttached
                          ? 'bg-[#2D8B5C]/10 border-[#2D8B5C] font-semibold text-[#161F1A]'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={isAttached}
                          onChange={() => handleToggleSibling(st.studentId)}
                          className="rounded text-[#2D8B5C]"
                        />
                        <span className="truncate">{st.name}</span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-800">
                        ${st.monthlyFee || 100}
                      </span>
                    </label>
                  );
                })}
              </div>

              <p className="text-[10px] text-[#5A6B61]">
                The aggregate fee sums the monthly tuition across all attached siblings. Sibling discount is applied below.
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                {isFamilyInvoice ? 'Aggregate Fee' : 'Amount'} ({getCurrencySymbol(currency)})
              </label>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white font-medium"
              >
                {ALLOWED_CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                {isFamilyInvoice ? 'Sibling Discount' : 'Discount'} ({getCurrencySymbol(currency)})
              </label>
              <input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs font-medium text-emerald-700"
              />
            </div>
          </div>

          {/* Net payable summary */}
          <div className="p-2.5 rounded-lg bg-[#FAF9F7] border border-[#E3DFD7] flex items-center justify-between text-xs">
            <span className="text-[#5A6B61]">Net Payable Statement Total:</span>
            <span className="font-bold font-mono text-sm text-[#1E5C3D]">
              {getCurrencySymbol(currency)}{Math.max(0, amount - discount).toLocaleString()} {currency}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Billing Period</label>
              <input
                type="text"
                value={billingPeriod}
                onChange={(e) => setBillingPeriod(e.target.value)}
                placeholder="e.g. September 2026"
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FeeStatus)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white font-medium"
              >
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
                <option value="Waived">Waived</option>
              </select>
            </div>
            {status === 'Paid' && (
              <div>
                <label className="block text-xs font-semibold text-[#161F1A] mb-1">Payment Method</label>
                <input
                  type="text"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  placeholder="e.g. Bank Transfer, Stripe, Cash"
                  className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#161F1A] mb-1">Invoice Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Sibling discount applied, fast settlement"
              className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs"
            />
          </div>

          <div className="pt-3 border-t border-[#E3DFD7] flex items-center justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium text-[#5A6B61] hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
            <button
              id="submit_fee_button"
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded-lg shadow-xs flex items-center space-x-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{saving ? 'Saving...' : (isFamilyInvoice ? 'Save Combined Invoice' : 'Save Invoice')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
