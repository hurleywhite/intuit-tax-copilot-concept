// Fictional sample documents. No real taxpayer data.
export const DOCS = {
  w2: {
    name: 'W-2',
    steps: ['Reading the document', 'Found wages and withholding', "Compared with last year's return"],
    fields: [
      ['Employer', 'Sample Co.'],
      ['Wages', '$62,400'],
      ['Federal tax withheld', '$7,120'],
      ['State tax withheld', '$2,310'],
      ["Last year's wages", '$58,900'],
    ],
  },
  nec: {
    name: '1099-NEC',
    steps: ['Reading the document', 'Found freelance income', 'Flagged the self-employment section'],
    fields: [
      ['Payer', 'Sample Design LLC'],
      ['Freelance income', '$4,800'],
    ],
  },
};

export const SUGGESTED = [
  'What should I double check before filing?',
  'Why might my refund change from last year?',
  'I also did some freelance work. What changes?',
];

export function fallbackAnswer(question, docKeys) {
  const q = question.toLowerCase();
  const hasW2 = docKeys.includes('w2');
  const hasNec = docKeys.includes('nec');
  if (q.includes('freelance') || q.includes('1099') || q.includes('self')) {
    return hasNec
      ? 'Your 1099-NEC shows $4,800 of freelance income. That goes in the self-employment section, and it can add self-employment tax on top of income tax. Because it changes what you owe, an expert should look it over before you file.'
      : 'I can add that. Upload a 1099-NEC, or tell me the amount, and I will move you to the self-employment section. This changes what you owe, so an expert can look it over.';
  }
  if (q.includes('refund')) {
    return hasW2
      ? 'Your wages are about $3,500 higher than last year. More income usually means more tax owed, so the refund can be smaller unless your withholding went up too. Add any deductions you have and I will recalculate.'
      : 'Upload your W-2 first. I compare it with last year to explain what moved your refund.';
  }
  if (hasW2) {
    return 'Three things before you file: 1. Your employer and wages match the W-2 you uploaded. 2. State withholding of $2,310 is entered once, not twice. 3. If you earned money outside this job, add it now so the return is complete.';
  }
  return 'Add a document first, then ask me about it. I can help with questions about your return.';
}
