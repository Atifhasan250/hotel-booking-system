"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import styles from "./site-header.module.css";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/#about", label: "About" },
  { href: "/#stays", label: "Hotels" },
  { href: "/#destinations", label: "Destinations" },
  { href: "/#cars", label: "Cars · Coming soon" },
] as const;

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Book My Room home" onClick={() => setMenuOpen(false)}>
          <Image src="/bookmyroom-dark-no-bg.png" alt="Book My Room" width={225} height={130} priority />
        </Link>
        <nav id="site-navigation" className={menuOpen ? `${styles.navigation} ${styles.open}` : styles.navigation} aria-label="Primary navigation">
          {navigation.map((item) => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</Link>)}
        </nav>
        <div className={styles.actions}>
          <Link className={styles.partner} href="/vendor/onboarding">Become a Partner</Link>
          <Link className={styles.dashboard} href="/auth">Dashboard <ArrowRight size={15} aria-hidden="true" /></Link>
          <button className={styles.menuButton} type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="site-navigation" aria-label={menuOpen ? "Close navigation" : "Open navigation"}>
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </header>
      {!overlay && <div className={styles.spacer} aria-hidden="true" />}
    </>
  );
}
