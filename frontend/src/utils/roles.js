const R = {
  super_admin: ['सुपर प्रशासक', 'Super administrator'], office_admin: ['कार्यालय प्रशासक', 'Office administrator'],
  agriculture_officer: ['कृषि अधिकृत', 'Agriculture officer'], agriculture_technician: ['कृषि प्राविधिक', 'Agriculture technician'],
  iot_operator: ['स्मार्ट फार्मिङ सञ्चालक', 'Smart farming operator'], content_manager: ['सामग्री व्यवस्थापक', 'Content manager'],
  farmer: ['कृषक', 'Farmer'], learner: ['शिक्षार्थी', 'Learner']
};
export const roleLabel = (code, lang) => (R[code] ? R[code][lang === 'en' ? 1 : 0] : code);
