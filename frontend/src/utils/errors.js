export const errMsgs = (err) => {
  const d = err.response?.data;
  return d?.errors?.map((x) => `${x.field}: ${x.message}`) || [d?.message || 'Request failed'];
};
