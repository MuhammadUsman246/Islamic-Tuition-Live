import { StudentFee, Student } from '../types';

export interface FamilyFeeSummary {
  familyGroupId: string;
  familyGroupName: string;
  totalAmount: number;
  currency: string;
  studentIds: string[];
  studentNames: string[];
  invoices: StudentFee[];
  status: 'Paid' | 'Pending' | 'Overdue';
}

/**
 * Aggregates student balances and invoices into 'Family Group' totals while 
 * adhering to role-based access control.
 * 
 * - Admin/Supervisor: Full access to all family groups and individual student fees.
 * - Parent: Aggregates multiple children IDs into a single combined family total alongside individual child fees.
 * - Student: Sees only their own personal fee balance.
 */
export function calculateFamilyBalance(
  students: Student[],
  fees: StudentFee[],
  userRole: 'admin' | 'supervisor' | 'tutor' | 'student' | 'parent',
  userStudentId?: string,
  userLinkedStudentIds?: string[]
): {
  personalFees: StudentFee[];
  familySummaries: FamilyFeeSummary[];
  totalPending: number;
  totalOverdue: number;
  totalRevenue: number;
} {
  let filteredFees = fees;

  // 1. Role-based filtering
  if (userRole === 'student' && userStudentId) {
    filteredFees = fees.filter(f => f.studentId === userStudentId || (f.studentIds && f.studentIds.includes(userStudentId)));
  } else if (userRole === 'parent' && userLinkedStudentIds && userLinkedStudentIds.length > 0) {
    filteredFees = fees.filter(f => 
      (f.studentId && userLinkedStudentIds.includes(f.studentId)) || 
      (f.studentIds && f.studentIds.some(id => userLinkedStudentIds.includes(id)))
    );
  }

  // 2. Calculate totals
  let totalPending = 0;
  let totalOverdue = 0;
  let totalRevenue = 0;

  filteredFees.forEach(fee => {
    if (fee.status === 'Pending') {
      totalPending += fee.amount;
    } else if (fee.status === 'Overdue') {
      totalOverdue += fee.amount;
    } else if (fee.status === 'Paid') {
      totalRevenue += fee.amount;
    }
  });

  // 3. Group by familyGroupId for combined family fee summaries
  const familyMap = new Map<string, {
    familyGroupId: string;
    familyGroupName: string;
    totalAmount: number;
    currency: string;
    studentIds: Set<string>;
    studentNames: Set<string>;
    invoices: StudentFee[];
    statuses: Set<string>;
  }>();

  fees.forEach(fee => {
    const groupId = fee.familyGroupId || (fee.studentId ? `SINGLE-${fee.studentId}` : 'GENERAL');
    const groupName = fee.familyGroupName || (fee.studentName ? `${fee.studentName}'s Family` : 'Standard Family');

    if (!familyMap.has(groupId)) {
      familyMap.set(groupId, {
        familyGroupId: groupId,
        familyGroupName: groupName,
        totalAmount: 0,
        currency: fee.currency || 'USD',
        studentIds: new Set<string>(),
        studentNames: new Set<string>(),
        invoices: [],
        statuses: new Set<string>()
      });
    }

    const fam = familyMap.get(groupId)!;
    fam.totalAmount += fee.amount;
    fam.invoices.push(fee);
    fam.statuses.add(fee.status);
    if (fee.studentId) fam.studentIds.add(fee.studentId);
    if (fee.studentName) fam.studentNames.add(fee.studentName);
    if (fee.studentIds) {
      fee.studentIds.forEach(id => fam.studentIds.add(id));
    }
  });

  const familySummaries: FamilyFeeSummary[] = Array.from(familyMap.values()).map(fam => {
    let combinedStatus: 'Paid' | 'Pending' | 'Overdue' = 'Paid';
    if (fam.statuses.has('Overdue')) {
      combinedStatus = 'Overdue';
    } else if (fam.statuses.has('Pending')) {
      combinedStatus = 'Pending';
    }

    return {
      familyGroupId: fam.familyGroupId,
      familyGroupName: fam.familyGroupName,
      totalAmount: fam.totalAmount,
      currency: fam.currency,
      studentIds: Array.from(fam.studentIds),
      studentNames: Array.from(fam.studentNames),
      invoices: fam.invoices,
      status: combinedStatus
    };
  });

  return {
    personalFees: filteredFees,
    familySummaries,
    totalPending,
    totalOverdue,
    totalRevenue
  };
}
