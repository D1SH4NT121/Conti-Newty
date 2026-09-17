"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion";

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const defaultFaqItems: FaqItem[] = [
  {
    id: "item-1",
    question: "How does Continewty differ from standard Vector RAG?",
    answer:
      "Standard RAG splits text into arbitrary chunks and converts them to opaque embeddings. Continewty maintains plain Markdown in a Git repository, using deterministic AST traversal and grep with exact line numbers and SHA-256 verification.",
  },
  {
    id: "item-2",
    question: "Where is our company knowledge stored?",
    answer:
      "In a standard Git repository that you own. Continewty connects directly to your GitHub, GitLab, or self-hosted Git remote. There are zero proprietary vector lock-ins.",
  },
  {
    id: "item-3",
    question: "Can autonomous agents write back to our Company Brain?",
    answer:
      "Yes, but strictly under policy enclave guardrails. Agents can draft changes or commit verified incident resolutions as git branches/PRs requiring human co-signing before merge.",
  },
  {
    id: "item-4",
    question: "What happens if a source like Slack or Google Drive is disconnected?",
    answer:
      "All past synchronized knowledge remains permanently accessible in your immutable Git repository. Continewty never loses historical knowledge when third-party APIs experience downtime.",
  },
  {
    id: "item-5",
    question: "Is our data used to train any external AI models?",
    answer:
      "Never. Continewty adheres to strict Zero Data Retention policies. Your code and company context are never used for model fine-tuning or training.",
  },
];

export const BlurredStagger: React.FC<{ text: string }> = ({ text }) => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.008,
      },
    },
  };

  const letterAnimation = {
    hidden: {
      opacity: 0,
      filter: "blur(10px)",
      y: 3,
    },
    show: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
    },
  };

  return (
    <div className="w-full">
      <motion.p
        variants={container}
        initial="hidden"
        animate="show"
        className="text-sm sm:text-base text-zinc-400 leading-relaxed break-words whitespace-normal font-sans"
      >
        {text.split("").map((char, index) => (
          <motion.span
            key={index}
            variants={letterAnimation}
            transition={{ duration: 0.25 }}
            className="inline-block"
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        ))}
      </motion.p>
    </div>
  );
};

interface TextRevealFaqsProps {
  items?: FaqItem[];
  title?: string;
  subtitle?: string;
}

export const TextRevealFaqs: React.FC<TextRevealFaqsProps> = ({
  items = defaultFaqItems,
  title = "Architecture & Trust.",
  subtitle = "Everything you need to know about git-backed company reasoning.",
}) => {
  return (
    <section className="py-20 md:py-28 max-w-7xl mx-auto px-6" id="faq">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        {/* Left column */}
        <div className="lg:col-span-5 space-y-4">
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            FREQUENTLY ASKED QUESTIONS
          </p>
          <h2 className="font-serif text-4xl sm:text-5xl font-light text-foreground leading-tight">
            {title}
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed max-w-md">
            {subtitle}
          </p>
          <div className="pt-4 border-t border-border/60">
            <p className="text-xs font-mono text-muted-foreground">
              Need custom enclave deployment?{' '}
              <a href="#integrations" className="text-foreground font-bold hover:underline">
                Explore Agent MCP
              </a>
            </p>
          </div>
        </div>

        {/* Right column Accordion */}
        <div className="lg:col-span-7">
          <Accordion defaultValue="item-1" collapsible className="space-y-2">
            {items.map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="border-b border-border/80 pb-1"
              >
                <AccordionTrigger className="cursor-pointer text-base sm:text-lg font-serif font-light text-foreground hover:text-foreground/80 hover:no-underline py-4">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent>
                  <BlurredStagger text={item.answer} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default TextRevealFaqs;
