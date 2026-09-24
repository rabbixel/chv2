"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { routes } from "@/lib/routes";
import styles from "./SearchBar.module.css";

export interface SearchBarProps {
  id: string;
  defaultValue?: string;
  placeholder?: string;
}

export function SearchBar({
  id,
  defaultValue = "",
  placeholder = "Search fonts, graphics, templates…",
}: SearchBarProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push(routes.search(value.trim()));
  };

  return (
    <form role="search" className={styles.form} onSubmit={onSubmit}>
      <label htmlFor={id} className="ch-visually-hidden">
        Search products
      </label>
      <input
        id={id}
        type="search"
        className={styles.input}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoComplete="off"
      />
      <button type="submit" className={styles.submit}>
        Search
      </button>
    </form>
  );
}
