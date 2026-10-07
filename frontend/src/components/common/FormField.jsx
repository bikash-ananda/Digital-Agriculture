export const inputCls = 'mt-1 w-full border rounded p-2 bg-white';

export default function FormField({ label, children, className = '' }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
