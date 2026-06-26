"use client";

type Option<T> = {
  value: T;
  label: string;
  description?: string;
};

/**
 * 汎用ラジオボタングループ。
 * spacious を明示指定するか、options に description を持つ要素が含まれる場合に
 * spacious スタイル（行間広め・上揃え・text-base）を使用し description テキストをラベル下に表示する。
 * それ以外は compact スタイル（行間狭め・中央揃え・text-sm）。
 * name に一意な文字列を指定することで同一ページ内の複数グループが干渉しない。
 */
export default function RadioGroup<T extends string | boolean>({
  name,
  options,
  value,
  onChange,
  spacious,
}: {
  name: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  /** true にすると行間・文字サイズを広めにし description を表示する。省略時は options から自動判定。 */
  spacious?: boolean;
}) {
  const hasDescriptions = spacious ?? options.some((opt) => !!opt.description);

  return (
    <div className={`flex flex-col ${hasDescriptions ? "gap-3" : "gap-1.5"}`}>
      {options.map((opt) => (
        <label
          key={String(opt.value)}
          className={`flex gap-2 cursor-pointer ${hasDescriptions ? "items-start" : "items-center"}`}
        >
          <input
            type="radio"
            name={name}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className={`w-4 h-4 accent-foreground shrink-0${hasDescriptions ? " mt-0.5" : ""}`}
          />
          {hasDescriptions ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-base">{opt.label}</span>
              {opt.description && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {opt.description}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm">{opt.label}</span>
          )}
        </label>
      ))}
    </div>
  );
}
