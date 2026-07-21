import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";

export default function CustomDropdown({
  label,
  value,
  options = [],
  onChange,
  placeholder = "Select option...",
  icon: Icon,
  className = "",
  menuClassName = "",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 bg-navy-950 border border-navy-700 hover:border-navy-600 disabled:opacity-50 text-white rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all outline-none ${
          open ? "ring-2 ring-primary-500/50 border-primary-500/50" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          {Icon && <Icon className="w-3.5 h-3.5 text-primary-400 shrink-0" />}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180 text-primary-400" : ""}`} />
      </button>

      {open && (
        <div className={`absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto bg-navy-900 border border-navy-700/90 rounded-xl shadow-2xl py-1 backdrop-blur-md ${menuClassName}`}>
          {options.length === 0 ? (
            <div className="px-3.5 py-2 text-xs text-slate-400 text-center">No options available</div>
          ) : (
            options.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2 text-left text-xs transition-colors hover:bg-navy-800 ${
                    isSelected ? "bg-primary-500/10 text-primary-300 font-bold" : "text-slate-300"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary-400 shrink-0 ml-2" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
