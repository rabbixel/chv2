"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Icon, type IconName } from "@/components/ui";
import {
  RECENT_SEARCHES_KEY,
  RECENT_SEARCHES_LIMIT,
} from "@/lib/navigation";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import styles from "./SearchBar.module.css";

export interface SearchBarCategory {
  name: string;
  slug: string;
}

export interface SearchBarProps {
  id: string;
  defaultValue?: string;
  placeholder?: string;
  /** Category suggestions (from the category service via the header). */
  categories?: SearchBarCategory[];
  popularSearches?: string[];
}

interface Suggestion {
  key: string;
  label: string;
  hint?: string;
  icon: IconName;
  run: () => void;
}

interface SuggestionSection {
  title: string;
  action?: { label: string; run: () => void };
  options: Suggestion[];
}

function readRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

export function SearchBar({
  id,
  defaultValue = "",
  placeholder = "Search fonts, graphics, templates…",
  categories = [],
  popularSearches = [],
}: SearchBarProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Lazy init keeps SSR safe (no window on the server) and avoids a
  // setState-in-effect. The panel is closed initially so there is no
  // hydration mismatch.
  const [recent, setRecent] = useState<string[]>(() => readRecentSearches());
  const listId = `${id}-suggestions`;

  // Close on outside interaction.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!formRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open ]);

  const persistRecent = (entries: string[]) => {
    setRecent(entries);
    try {
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(entries));
    } catch {
      // Private mode etc. — recent searches are a convenience, not critical.
    }
  };

  const submitQuery = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    persistRecent(
      [trimmed, ...recent.filter((entry) => entry !== trimmed)].slice(
        0,
        RECENT_SEARCHES_LIMIT,
      ),
    );
    setOpen(false);
    setActiveIndex(-1);
    router.push(routes.search(trimmed));
  };

  const sections: SuggestionSection[] = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) {
      const built: SuggestionSection[] = [];
      if (recent.length > 0) {
        built.push({
          title: "Recent searches",
          action: { label: "Clear", run: () => persistRecent([]) },
          options: recent.map((entry) => ({
            key: `recent-${entry}`,
            label: entry,
            icon: "clock",
            run: () => submitQuery(entry),
          })),
        });
      }
      if (popularSearches.length > 0) {
        built.push({
          title: "Popular right now",
          options: popularSearches.slice(0, 6).map((entry) => ({
            key: `popular-${entry}`,
            label: entry,
            icon: "trend",
            run: () => submitQuery(entry),
          })),
        });
      }
      return built;
    }
    const matchingCategories = categories.filter((category) =>
      category.name.toLowerCase().includes(query),
    );
    const matchingPopular = popularSearches.filter((entry) =>
      entry.toLowerCase().includes(query),
    );
    const built: SuggestionSection[] = [
      {
        title: "Search",
        options: [
          {
            key: `query-${query}`,
            label: value.trim(),
            hint: "in All products",
            icon: "search",
            run: () => submitQuery(value),
          },
        ],
      },
    ];
    if (matchingCategories.length > 0) {
      built.push({
        title: "Categories",
        options: matchingCategories.slice(0, 4).map((category) => ({
          key: `category-${category.slug}`,
          label: category.name,
          hint: "Category",
          icon: "chevron-right",
          run: () => {
            setOpen(false);
            router.push(routes.category(category.slug));
          },
        })),
      });
    }
    if (matchingPopular.length > 0) {
      built.push({
        title: "Popular matches",
        options: matchingPopular.slice(0, 4).map((entry) => ({
          key: `match-${entry}`,
          label: entry,
          icon: "trend",
          run: () => submitQuery(entry),
        })),
      });
    }
    return built;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, recent, popularSearches, categories]);

  const flatOptions = useMemo(
    () => sections.flatMap((section) => section.options),
    [sections],
  );

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (activeIndex >= 0 && flatOptions[activeIndex]) {
      flatOptions[activeIndex].run();
    } else {
      submitQuery(value);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (flatOptions.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        const next = current + delta;
        if (next < 0) return flatOptions.length - 1;
        if (next >= flatOptions.length) return 0;
        return next;
      });
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const showPanel = open && flatOptions.length > 0;

  return (
    <form
      ref={formRef}
      role="search"
      className={styles.form}
      onSubmit={onSubmit}
      autoComplete="off"
    >
      <label htmlFor={id} className="ch-visually-hidden">
        Search products
      </label>
      <span className={styles.icon} aria-hidden="true">
        <Icon name="search" size={18} />
      </span>
      <input
        id={id}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-activedescendant={
          activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
        }
        className={styles.input}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />
      <button type="submit" className={styles.submit}>
        Search
      </button>
      {showPanel && (
        <div className={styles.panel} role="presentation">
          <ul role="listbox" id={listId} aria-label="Search suggestions" className={styles.list}>
            {sections.map((section) => (
              <li key={section.title} className={styles.section}>
                <p className={styles.sectionTitle}>
                  <span>{section.title}</span>
                  {section.action && (
                    <button
                      type="button"
                      className={styles.sectionAction}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={section.action.run}
                    >
                      {section.action.label}
                    </button>
                  )}
                </p>
                <ul className={styles.options}>
                  {section.options.map((option) => {
                    const index = flatOptions.indexOf(option);
                    return (
                      <li
                        key={option.key}
                        id={`${listId}-option-${index}`}
                        role="option"
                        aria-selected={index === activeIndex}
                        className={cn(
                          styles.option,
                          index === activeIndex && styles.optionActive,
                        )}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={option.run}
                        onMouseEnter={() => setActiveIndex(index)}
                      >
                        <Icon name={option.icon} size={16} />
                        <span className={styles.optionLabel}>{option.label}</span>
                        {option.hint && (
                          <span className={styles.optionHint}>{option.hint}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
