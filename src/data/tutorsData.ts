import { Tutor, UserProfile } from '../types';

export interface RegisteredTutorConfig {
  tutorNumber: number;
  tutorId: string;
  displayName: string;
  email: string;
  password: string;
  salaryPKR: number;
  realName: string;
  phone: string;
  status: 'Active';
  role: 'tutor';
  zoomLink: string;
}

export const INITIAL_REGISTERED_TUTORS: RegisteredTutorConfig[] = [
  {
    tutorNumber: 1,
    tutorId: 'Tutor 1',
    displayName: 'Tutor 1',
    email: 'tutor1islamictuition@gmail.com',
    password: 'bRasuais@1',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/5110634153?pwd=WnhIN2J1NENFeWlXWml4UTlRR1g3UT09'
  },
  {
    tutorNumber: 2,
    tutorId: 'Tutor 2',
    displayName: 'Tutor 2',
    email: 'tutor2islamictuition@gmail.com',
    password: 'bRasuais@2',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/4992463502?pwd=ZzNudHlWMlpHUmJ2UDkwNGcwS0VIZz09'
  },
  {
    tutorNumber: 3,
    tutorId: 'Tutor 3',
    displayName: 'Tutor 3',
    email: 'tutor3islamictuition@gmail.com',
    password: 'bRasuais@3',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/6142416505?pwd=dEg4cE9TMGtXQ0w1ZVpXOEpyYjF0Zz09'
  },
  {
    tutorNumber: 4,
    tutorId: 'Tutor 4',
    displayName: 'Tutor 4',
    email: 'tutor4islamictuition@gmail.com',
    password: 'bRasuais@4',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/8761486788?pwd=mxratPOPmXIe2AioSKLay7kaZtRkFH.1'
  },
  {
    tutorNumber: 5,
    tutorId: 'Tutor 5',
    displayName: 'Tutor 5',
    email: 'tutor5islamictuition@gmail.com',
    password: 'bRasuais@5',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/6483674554?pwd=3alrVYKGRugyCNdGFPcRg3hjAoSblv.1'
  },
  {
    tutorNumber: 6,
    tutorId: 'Tutor 6',
    displayName: 'Tutor 6',
    email: 'tutor6islamictuition@gmail.com',
    password: 'bRasuais@6',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/5124116283?pwd=TnBRYTBuQVluQVc4c2xsWm5pMnhzdz09'
  },
  {
    tutorNumber: 7,
    tutorId: 'Tutor 7',
    displayName: 'Tutor 7',
    email: 'tutor7islamictuition@gmail.com',
    password: 'bRasuais@7',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/8264617083?pwd=5CXd9CGeQ36gV0kClV8Cpac48HUhpQ.1'
  },
  {
    tutorNumber: 8,
    tutorId: 'Tutor 8',
    displayName: 'Tutor 8',
    email: 'tutor8islamictuition@gmail.com',
    password: 'bRasuais@8',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/8893109410?pwd=N1FyU203bXV5N2lwdWVkcXJNemQrdz09'
  },
  {
    tutorNumber: 9,
    tutorId: 'Tutor 9',
    displayName: 'Tutor 9',
    email: 'tutor9islamictuition@gmail.com',
    password: 'bRasuais@9',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/7411414001?pwd=L1R3TUVnSDM3M093T09wTVptRkdudz09'
  },
  {
    tutorNumber: 10,
    tutorId: 'Tutor 10',
    displayName: 'Tutor 10',
    email: 'tutor10islamictuition@gmail.com',
    password: 'bRasuais@10',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/4013831297?pwd=dk9tSWFmUlpqc0dxUWdqSFErTzZHUT09'
  },
  {
    tutorNumber: 11,
    tutorId: 'Tutor 11',
    displayName: 'Tutor 11',
    email: 'tutor11islamictuition@gmail.com',
    password: 'bRasuais@11',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/9768207905?pwd=yEU0QWC7EvXEQgDdojPY2SXjFj1fdT.1'
  },
  {
    tutorNumber: 12,
    tutorId: 'Tutor 12',
    displayName: 'Tutor 12',
    email: 'tutor12islamictuition@gmail.com',
    password: 'bRasuais@12',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/6805712476?pwd=uvB8ntb88jbw7QtOd9cyrMlbXr4C0M.1'
  },
  {
    tutorNumber: 13,
    tutorId: 'Tutor 13',
    displayName: 'Tutor 13',
    email: 'tutor13islamictuition@gmail.com',
    password: 'bRasuais@13',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/7238438155?pwd=jkH2Y4BE3Yiybm9Xa9nEOTznnpac2f.1'
  },
  {
    tutorNumber: 14,
    tutorId: 'Tutor 14',
    displayName: 'Tutor 14',
    email: 'tutor14islamictuition@gmail.com',
    password: 'bRasuais@14',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/4284956845?pwd=D48aOgE8L87eZYI8Al7Kq11NRKwsCb.1'
  },
  {
    tutorNumber: 15,
    tutorId: 'Tutor 15',
    displayName: 'Tutor 15',
    email: 'tutor15islamictuition@gmail.com',
    password: 'bRasuais@15',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/4300902143?pwd=WfclX42LwBARj3VnQ9wDjuqYnXuxD7.1'
  },
  {
    tutorNumber: 16,
    tutorId: 'Tutor 16',
    displayName: 'Tutor 16',
    email: 'tutor16islamictuition@gmail.com',
    password: 'bRasuais@16',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/7783184431?pwd=MqtYT5tYMbQdEvigmwzb3ak6WeFOMB.1'
  },
  {
    tutorNumber: 17,
    tutorId: 'Tutor 17',
    displayName: 'Tutor 17',
    email: 'tutor17islamictuition@gmail.com',
    password: 'bRasuais@17',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/2027694953?pwd=tM0vNbfqa4vjrHc4trCepzgIHf0BhQ.1'
  },
  {
    tutorNumber: 18,
    tutorId: 'Tutor 18',
    displayName: 'Tutor 18',
    email: 'tutor18islamictuition@gmail.com',
    password: 'bRasuais@18',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/6577965348?pwd=hwFc9v4SgZt1cVkF4rQOmlZZxYivoW.1'
  },
  {
    tutorNumber: 19,
    tutorId: 'Tutor 19',
    displayName: 'Tutor 19',
    email: 'tutor19islamictuition@gmail.com',
    password: 'bRasuais@19',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/4591007665?pwd=DgmAjEaRsUkjWnf4tBSUMaZaxocbBD.1'
  },
  {
    tutorNumber: 20,
    tutorId: 'Tutor 20',
    displayName: 'Tutor 20',
    email: 'tutor020islamictuition@gmail.com',
    password: 'bRasuais@20',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/2533071345?pwd=azhQi99M8VhPHQSqAvNl2xt60g7knJ.1'
  },
  {
    tutorNumber: 21,
    tutorId: 'Tutor 21',
    displayName: 'Tutor 21',
    email: 'tutor21islamictuition@gmail.com',
    password: 'bRasuais@21',
    salaryPKR: 23000,
    realName: '',
    phone: '',
    status: 'Active',
    role: 'tutor',
    zoomLink: 'https://us05web.zoom.us/j/9128374650?pwd=tuition_secret_21'
  }
];

export const INITIAL_TUTOR_ENTITIES: Tutor[] = INITIAL_REGISTERED_TUTORS.map((t) => ({
  id: `tutor_${t.tutorNumber}`,
  tutorId: t.tutorId,
  realName: t.realName,
  email: t.email,
  phone: t.phone,
  zoomLink: t.zoomLink,
  status: 'Active',
  availabilityStatus: 'Available',
  monthlySalaryPKR: t.salaryPKR,
  hourlyRatePKR: Math.round(t.salaryPKR / 40),
  assignedStudentIds: t.tutorId === 'Tutor 2' 
    ? ['STU-133', 'STU-134', 'STU-135', 'STU-136', 'STU-137', 'STU-138', 'STU-139']
    : t.tutorId === 'Tutor 3'
    ? ['STU-140', 'STU-141', 'STU-142', 'STU-143', 'STU-144', 'STU-145', 'STU-146', 'STU-147', 'STU-148', 'STU-149']
    : t.tutorId === 'Tutor 4'
    ? ['STU-150', 'STU-151', 'STU-152', 'STU-153', 'STU-154', 'STU-155', 'STU-156', 'STU-157']
    : t.tutorId === 'Tutor 5'
    ? ['STU-158', 'STU-159', 'STU-160', 'STU-161', 'STU-162', 'STU-163', 'STU-164', 'STU-165', 'STU-166']
    : t.tutorId === 'Tutor 6'
    ? ['STU-167', 'STU-168', 'STU-169', 'STU-170', 'STU-171', 'STU-172', 'STU-173', 'STU-174', 'STU-175', 'STU-176', 'STU-276']
    : t.tutorId === 'Tutor 7'
    ? ['STU-177', 'STU-178', 'STU-179', 'STU-180', 'STU-181', 'STU-182', 'STU-183', 'STU-184', 'STU-185']
    : t.tutorId === 'Tutor 8'
    ? ['STU-186', 'STU-187', 'STU-188', 'STU-189', 'STU-190', 'STU-191', 'STU-192', 'STU-193', 'STU-194', 'STU-195', 'STU-196']
    : t.tutorId === 'Tutor 9'
    ? ['STU-197', 'STU-198', 'STU-199', 'STU-200', 'STU-201', 'STU-202', 'STU-203', 'STU-204', 'STU-205', 'STU-206']
    : t.tutorId === 'Tutor 10'
    ? ['STU-207', 'STU-208', 'STU-209', 'STU-210', 'STU-211', 'STU-212', 'STU-213', 'STU-214']
    : t.tutorId === 'Tutor 13'
    ? ['STU-215', 'STU-216', 'STU-217', 'STU-218', 'STU-219', 'STU-220', 'STU-221', 'STU-222']
    : t.tutorId === 'Tutor 14'
    ? ['STU-223', 'STU-224', 'STU-225', 'STU-226', 'STU-227', 'STU-228', 'STU-229']
    : t.tutorId === 'Tutor 15'
    ? ['STU-230', 'STU-231', 'STU-232', 'STU-233', 'STU-234', 'STU-235', 'STU-236', 'STU-237']
    : t.tutorId === 'Tutor 16'
    ? ['STU-238', 'STU-239', 'STU-240', 'STU-241', 'STU-242', 'STU-243', 'STU-244', 'STU-245', 'STU-246']
    : t.tutorId === 'Tutor 17'
    ? ['STU-247', 'STU-248', 'STU-249', 'STU-250', 'STU-251', 'STU-252', 'STU-253', 'STU-254', 'STU-255', 'STU-256']
    : t.tutorId === 'Tutor 18'
    ? ['STU-257', 'STU-258', 'STU-259', 'STU-260', 'STU-261', 'STU-262', 'STU-263', 'STU-264', 'STU-265']
    : t.tutorId === 'Tutor 19'
    ? ['STU-266', 'STU-267', 'STU-268', 'STU-269', 'STU-270', 'STU-271', 'STU-272', 'STU-273']
    : t.tutorId === 'Tutor 20'
    ? ['STU-274', 'STU-275']
    : [],
  createdAt: '2026-09-20T00:00:00.000Z'
}));

export const INITIAL_TUTOR_USER_PROFILES: UserProfile[] = INITIAL_REGISTERED_TUTORS.map((t) => ({
  uid: `tutor_user_${t.tutorNumber}`,
  email: t.email,
  displayName: t.displayName,
  role: 'tutor',
  status: 'active',
  tutorId: t.tutorId,
  phone: t.phone,
  country: 'Pakistan',
  timezone: 'Asia/Karachi',
  createdAt: '2026-09-20T00:00:00.000Z'
}));
