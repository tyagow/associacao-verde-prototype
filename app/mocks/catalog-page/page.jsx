"use client";

import { useState } from "react";
import Brand from "../../components/Brand";
import { ChevronDown, ChevronUp, Minus, Plus, Trash2 } from "lucide-react";
import styles from "./catalog-page.module.css";

const products = [
  {
    id: "oleo-cbd-10",
    name: "Oleo CBD 10%",
    category: "Oleo",
    description: "Frasco separado pela equipe para pacientes com receita ativa.",
    stock: "23 frascos",
    price: "R$ 180,00",
    selected: true,
    quantity: 1,
  },
  {
    id: "oleo-full-20",
    name: "Oleo Full Spectrum 20%",
    category: "Oleo",
    description: "Opcao recorrente com conferencia de receita antes da entrega.",
    stock: "13 frascos",
    price: "R$ 240,00",
    selected: true,
    quantity: 1,
  },
  {
    id: "flor-24k",
    name: "Flor 24k",
    category: "Flor",
    description: "Produto em gramas, controlado por lote e disponibilidade.",
    stock: "92 g",
    price: "R$ 22,00 / g",
    selected: false,
    quantity: 5,
  },
  {
    id: "goma-cbd-5",
    name: "Goma CBD 5mg",
    category: "Comestivel",
    description: "Uso conforme orientacao da equipe clinica e receita vigente.",
    stock: "8 caixas",
    price: "R$ 96,00",
    selected: false,
    quantity: 1,
  },
  {
    id: "topico-cbd",
    name: "Balm topico CBD",
    category: "Topico",
    description: "Formula topica sob disponibilidade e validacao de cadastro.",
    stock: "4 unidades",
    price: "R$ 120,00",
    selected: false,
    quantity: 1,
  },
  {
    id: "oleo-cbg",
    name: "Oleo CBG 5%",
    category: "Oleo",
    description: "Produto controlado com reserva somente depois do Pix gerado.",
    stock: "6 frascos",
    price: "R$ 210,00",
    selected: false,
    quantity: 1,
  },
];

const selectedProducts = products.filter((product) => product.selected);

export default function CatalogPageMock() {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <main className={styles.root}>
      <header className={styles.topbar}>
        <Brand />
        <nav aria-label="Portal do paciente">
          <a className={styles.navActive} href="#catalogo">
            Catalogo
          </a>
          <a href="#historico">Historico</a>
          <a href="#suporte">Suporte</a>
        </nav>
        <button className={styles.cartButton} type="button" onClick={() => setCartOpen(true)}>
          Carrinho · {selectedProducts.length}
        </button>
      </header>

      <section className={styles.pageShell}>
        <section className={styles.catalogPane} aria-labelledby="catalog-title">
          <div className={styles.heroRow}>
            <div>
              <p className={styles.kicker}>Produtos autorizados</p>
              <h1 id="catalog-title">Catalogo</h1>
              <p>
                Produtos liberados para o cadastro ativo. A reserva acontece somente quando o Pix e
                gerado.
              </p>
            </div>
            <div className={styles.patientBadge}>
              <span>Paciente</span>
              <strong>Helena Rocha</strong>
            </div>
          </div>

          <div className={styles.toolbar}>
            <label>
              Buscar
              <input type="search" placeholder="Buscar por oleo, flor, goma..." />
            </label>
            <div className={styles.segmented} aria-label="Filtros">
              <button className={styles.activeFilter} type="button">
                Todos
              </button>
              <button type="button">Oleos</button>
              <button type="button">Flores</button>
              <button type="button">Outros</button>
            </div>
          </div>

          <section id="catalogo" className={styles.productGrid} aria-label="Produtos">
            {products.map((product) => (
              <article
                key={product.id}
                className={`${styles.productCard} ${product.selected ? styles.productSelected : ""}`}
              >
                <div className={styles.productTop}>
                  <span>{product.category}</span>
                  <small>{product.stock}</small>
                </div>
                <h2>{product.name}</h2>
                <p>{product.description}</p>
                <div className={styles.productMeta}>
                  <strong>{product.price}</strong>
                  <label>
                    Qtd.
                    <input type="number" min="1" defaultValue={product.quantity} />
                  </label>
                </div>
                <button type="button">{product.selected ? "Atualizar" : "Adicionar"}</button>
              </article>
            ))}
          </section>
        </section>

        <aside
          className={`${styles.cartDrawer} ${cartOpen ? styles.cartDrawerOpen : ""}`}
          aria-label="Carrinho"
        >
          <button
            className={styles.mobileCartHandle}
            type="button"
            onClick={() => setCartOpen((current) => !current)}
            aria-expanded={cartOpen}
          >
            <span>
              Carrinho · {selectedProducts.length} · <strong>R$ 420,00</strong>
            </span>
            {cartOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
          <header>
            <button
              className={styles.mobileClose}
              type="button"
              onClick={() => setCartOpen(false)}
              aria-label="Recolher carrinho"
            >
              <ChevronDown size={18} />
            </button>
            <p className={styles.kicker}>Carrinho</p>
            <h2>Resumo antes do Pix</h2>
          </header>
          <ul className={styles.cartList}>
            {selectedProducts.map((product) => (
              <li key={product.id}>
                <div>
                  <strong>{product.name}</strong>
                  <span>
                    {product.quantity} item · {product.price}
                  </span>
                </div>
                <div className={styles.cartControls} aria-label={`Quantidade de ${product.name}`}>
                  <button type="button" aria-label={`Reduzir ${product.name}`}>
                    <Minus size={14} strokeWidth={2.4} />
                  </button>
                  <strong>{product.quantity}</strong>
                  <button type="button" aria-label={`Aumentar ${product.name}`}>
                    <Plus size={14} strokeWidth={2.4} />
                  </button>
                </div>
                <button
                  className={styles.removeButton}
                  type="button"
                  aria-label={`Remover ${product.name}`}
                >
                  <Trash2 size={15} strokeWidth={2.3} />
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.deliveryBox}>
            <label>
              Entrega
              <select defaultValue="GED Log via Melhor Envio">
                <option>GED Log via Melhor Envio</option>
                <option>Correios via Melhor Envio</option>
                <option>Retirada combinada</option>
              </select>
            </label>
          </div>
          <footer>
            <span>Total estimado</span>
            <strong>R$ 420,00</strong>
            <button type="button">Gerar Pix</button>
          </footer>
        </aside>
      </section>
    </main>
  );
}
