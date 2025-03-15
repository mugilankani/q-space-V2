export default function SelectDropdown({ label, value, onChange, options }) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <select
        className="w-full px-3 py-1 text-xs bg-white text-gray-800 border border-gray-300 rounded-lg"
        onChange={onChange}
        value={value}
      >
        <option disabled value="" className="text-gray-400 bg-gray-50">
          {options.length === 0 ? "No options available" : "Select an option"}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
