import { Link } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { trackViewContent, trackStartTrial, trackLead, trackContact } from "@/lib/pixel";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  Brain,
  Mic,
  Image as ImageIcon,
  Languages,
  ShoppingBag,
  CalendarCheck,
  Plug,
  Shield,
  Sparkles,
  Settings as SettingsIcon,
  Upload,
  Rocket,
  Check,
  Inbox,
  Megaphone,
  Globe,
  Star,
  Gift,
  Share2,
  Zap,
  Crown,
  PhoneOff,
  Truck,
  Headphones,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { VERTICALS } from "@/lib/verticals";
import inboxMockup from "@/assets/info-inbox-mockup.jpg";
import heroPhone from "@/assets/info-hero-phone.jpg";

import featureInbox from "@/assets/info-feature-inbox.jpg";
import confirmOrders from "@/assets/info-confirm-orders.png";

type Lang = "en" | "ar" | "fr";

const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "ar", label: "العربية", short: "AR" },
  { code: "fr", label: "Français", short: "FR" },
];
type ContentLang = Lang;
const contentLang = (l: Lang): ContentLang => l;


type Dict = {
  nav: { what: string; features: string; verticals: string; setup: string; pricing: string; faq: string; login: string; cta: string };
  hero: { eyebrow: string; titleA: string; titleB: string; sub: string; primary: string; secondary: string };
  what: { eyebrow: string; title: string; p1: string; p2: string };
  features: { eyebrow: string; title: string; sub: string; items: { title: string; desc: string }[] };
  verticals: { eyebrow: string; title: string; sub: string; cta: string };
  setup: { eyebrow: string; title: string; sub: string; items: { title: string; desc: string }[] };
  pricing: { eyebrow: string; title: string; sub: string; primary: string; secondary: string };
  faq: { eyebrow: string; title: string; items: { q: string; a: string }[] };
  cta: { title: string; sub: string; primary: string; secondary: string };
  footer: { tagline: string; product: string; resources: string; company: string };
};

const DICT: Record<ContentLang, Dict> = {
  en: {
    nav: { what: "What it is", features: "Features", verticals: "Industries", setup: "Setup", pricing: "Pricing", faq: "FAQ", login: "Login", cta: "Get Started Free" },
    hero: {
      eyebrow: "A complete guide",
      titleA: "Everything you need to know about ",
      titleB: "Jawabify",
      sub: "A thorough look at what Jawabify does, how it works, who it's for, and how to set it up. Take your time — this page is built to answer every question before you sign up.",
      primary: "Start Free Trial",
      secondary: "Read the overview",
    },
    what: {
      eyebrow: "01 · What is Jawabify",
      title: "An AI teammate that runs your WhatsApp & Instagram inbox.",
      p1: "Jawabify connects to your WhatsApp Business and Instagram accounts and replies to customers for you — 24/7, in Arabic, English, French, and even Lebanese dialect. It learns your products, services, pricing, and policies from URLs, documents, images, and past chats, so its answers always sound like you.",
      p2: "Beyond replies, Jawabify can take orders, book appointments, send catalogs, transcribe voice notes, share product photos, and hand off to a human the moment a conversation needs one. Every chat lands in a single shared inbox alongside the customer's full order and conversation history.",
    },
    features: {
      eyebrow: "02 · Features",
      title: "Built for the way conversations actually happen.",
      sub: "Every capability below ships out of the box. No plugins, no extra subscriptions.",
      items: [
        { title: "Trained on your business", desc: "Drop in URLs, PDFs, menus, catalogs, and past conversations. Jawabify builds a private knowledge base that grows over time." },
        { title: "Truly multilingual", desc: "Over 20 languages and dialects — Arabic (Lebanese, Egyptian, Gulf), English, French, Spanish, and more. Even mixed within a single message." },
        { title: "Voice note transcription", desc: "Customers send voice messages. Jawabify transcribes and responds in seconds, in the same language they spoke." },
        { title: "Sends pictures & catalogs", desc: "Pushes the right product photos, menus, location pins, and media inline — visual commerce, fully automated." },
        { title: "Order taking & checkout", desc: "Detects order intent, confirms items, applies your configurable delivery fee, and syncs straight to Shopify or your local pipeline." },
        { title: "Bookings & reminders", desc: "Schedules appointments, confirms slots, and sends reminders so your calendar fills itself without manual work." },
        { title: "Bulk WhatsApp campaigns", desc: "Send approved template broadcasts to thousands of contacts with built-in STOP opt-out handling and live delivery tracking." },
        { title: "Safe by design", desc: "Multi-tenant isolation, strict anti-hallucination rules, and human takeover whenever the AI isn't sure." },
      ],
    },
    verticals: {
      eyebrow: "03 · Industries",
      title: "One platform, tailored to your industry.",
      sub: "Jawabify ships with industry-specific playbooks — pick yours during onboarding and the AI, dashboard, and workflows reshape themselves around it.",
      cta: "See it for my industry",
    },
    setup: {
      eyebrow: "04 · Setup",
      title: "Five steps from signup to live AI.",
      sub: "Most teams are answering customers within an hour. No code, no migrations.",
      items: [
        { title: "Connect WhatsApp & Instagram", desc: "Sign in with Meta. We handle the official Cloud API setup — no developer needed." },
        { title: "Pick your industry", desc: "Restaurant, e-commerce, healthcare, real estate, wellness, or education. Each unlocks tailored tools and templates." },
        { title: "Feed it your knowledge", desc: "Paste URLs, upload menus or catalogs, drop product images. Jawabify ingests and indexes everything." },
        { title: "Set your tone, fee & rules", desc: "Choose default language, response length, delivery fee, working hours, and escalation triggers — all configurable." },
        { title: "Switch auto-reply on", desc: "When you're confident, flip the toggle. Jawabify handles new customers 24/7 from that moment on." },
      ],
    },
    pricing: {
      eyebrow: "05 · Pricing",
      title: "Plans that scale with your inbox.",
      sub: "Three plans — Starter, Growth, and Enterprise. All include the AI, multilingual support, and the shared inbox. Plans differ in number of channels, monthly conversations, and integrations.",
      primary: "Start 7-day free trial",
      secondary: "Compare all plans",
    },
    faq: {
      eyebrow: "06 · FAQ",
      title: "Questions, answered.",
      items: [
        { q: "How long does it take to set up?", a: "About 5 minutes. Connect your WhatsApp Business number, paste your website URL, and Jawabify trains itself on your products, prices and policies. Most businesses go live the same day with no developer involved." },
        { q: "Will it sound like a robot to my customers?", a: "No. You set the tone, personality and reply length, and the AI mirrors how your team actually talks — including Lebanese, Egyptian or Gulf dialect. Most customers can't tell it apart from a real agent." },
        { q: "How does it learn my business?", a: "Jawabify ingests your Shopify catalog, website URLs, PDFs, product images, FAQ pages and past WhatsApp conversations to build a private knowledge base scoped to your account only. It keeps learning from every new chat — spotting frequently asked questions, missed answers and patterns — and you can edit, add or remove any piece of knowledge at any time from Settings." },
        { q: "Do I need a WhatsApp Business API account?", a: "Yes, and we set it up for you during onboarding. You'll sign in with Meta and we handle the Cloud API configuration end-to-end — no developer required." },
        { q: "What languages does the AI handle?", a: "Over 20 languages and dialects — Arabic (Lebanese, Egyptian, Gulf), English, French, Spanish, Portuguese, Italian, Turkish, and more. It detects and replies in the same language the customer wrote in, even when they mix languages in one message." },
        { q: "Can it really understand voice messages?", a: "Yes. Voice notes are transcribed in seconds using multimodal models, including Lebanese Arabic. The AI replies based on the transcribed content like any text message." },
        { q: "What if the AI doesn't know an answer?", a: "It gracefully hands the chat over to your team and notifies you. You can also set rules to always escalate certain topics — refunds, complaints, or VIP customers — so nothing important is ever auto-answered." },
        { q: "Will it ever make up information?", a: "We've built strict anti-hallucination rules: the AI is instructed to never invent product details, prices, or customer info. When it isn't sure, it escalates to a human instead of guessing." },
        { q: "Does it work with Shopify?", a: "Yes — full two-way sync. Orders placed via chat sync into Shopify, and status or tracking updates from Shopify push back into the conversation automatically." },
        { q: "Is it really 30-day money back?", a: "Yes. If Jawabify doesn't earn back its cost in the first 30 days, we refund 100%. No forms, no questions asked." },
        { q: "What about human takeover?", a: "Any team member can take over a chat at any time from the shared inbox. You can also configure automatic handoff triggers — keywords, sentiment, or specific topics." },
        { q: "Is my data private?", a: "Every tenant is isolated at the database level with Row-Level Security. Your conversations, customers, and knowledge base are never shared with or used to train other tenants." },
      ],
    },
    cta: {
      title: "Ready to see it on your own inbox?",
      sub: "Start your free trial — no credit card required. Connect WhatsApp in minutes and watch Jawabify reply to your next customer.",
      primary: "Start Free Trial",
      secondary: "Back to overview",
    },
    footer: { tagline: "AI-powered WhatsApp & Instagram automation for businesses in the MENA region and beyond.", product: "Product", resources: "Resources", company: "Company" },
  },
  ar: {
    nav: { what: "ما هو", features: "الميزات", verticals: "القطاعات", setup: "الإعداد", pricing: "الأسعار", faq: "الأسئلة", login: "تسجيل الدخول", cta: "ابدأ مجاناً" },
    hero: {
      eyebrow: "دليل شامل",
      titleA: "كل ما تحتاج معرفته عن ",
      titleB: "جوابيفاي",
      sub: "نظرة معمّقة على ما يقدمه جوابيفاي، كيف يعمل، لمن هو موجَّه، وكيفية إعداده. خذ وقتك — هذه الصفحة بُنيت لتجيب على كل سؤال قبل أن تسجّل.",
      primary: "ابدأ التجربة المجانية",
      secondary: "اقرأ النظرة العامة",
    },
    what: {
      eyebrow: "01 · ما هو جوابيفاي",
      title: "موظف ذكاء اصطناعي يدير صندوق واتساب وانستغرام لك.",
      p1: "يتصل جوابيفاي بحساب واتساب بزنس وانستغرام الخاص بك ويرد على الزبائن نيابةً عنك — 24/7، باللغة العربية والإنجليزية والفرنسية وحتى اللهجة اللبنانية. يتعلّم منتجاتك وخدماتك وأسعارك وسياساتك من الروابط والمستندات والصور والمحادثات السابقة.",
      p2: "أكثر من مجرد ردود، يستطيع جوابيفاي استقبال الطلبات، حجز المواعيد، إرسال الكتالوجات، تفريغ الرسائل الصوتية، ومشاركة صور المنتجات، ثم تحويل المحادثة إلى موظف بشري عند الحاجة.",
    },
    features: {
      eyebrow: "02 · الميزات",
      title: "مصمَّم للطريقة التي تجري بها المحادثات فعلياً.",
      sub: "كل ميزة بالأسفل جاهزة من اليوم الأول. بدون إضافات أو اشتراكات منفصلة.",
      items: [
        { title: "مدرَّب على عملك", desc: "أضف روابط، ملفات PDF، قوائم، كتالوجات، ومحادثات سابقة. يبني جوابيفاي قاعدة معرفة خاصة بك تتطور مع الوقت." },
        { title: "متعدد اللغات حقاً", desc: "أكثر من 20 لغة ولهجة — عربي (لبناني، مصري، خليجي)، إنجليزي، فرنسي، إسباني، وغيرها — حتى لو اختلطت في رسالة واحدة." },
        { title: "تفريغ الرسائل الصوتية", desc: "يحوّل الصوتيات إلى نص خلال ثوانٍ ويرد بنفس اللغة التي تحدّث بها الزبون." },
        { title: "يرسل الصور والكتالوجات", desc: "يدفع الصور والقوائم ومواقع GPS والوسائط داخل المحادثة تلقائياً." },
        { title: "استقبال الطلبات والدفع", desc: "يكتشف نية الطلب، يؤكد العناصر، ويطبّق رسوم التوصيل القابلة للتعديل التي حدّدتها." },
        { title: "حجوزات وتذكيرات", desc: "يحجز المواعيد، يؤكدها، ويرسل تذكيرات حتى يمتلئ تقويمك تلقائياً." },
        { title: "حملات واتساب جماعية", desc: "أرسل قوالب معتمدة لآلاف الجهات مع معالجة تلقائية لطلبات إيقاف الاشتراك (STOP) وتتبع التسليم المباشر." },
        { title: "آمن بطبيعته", desc: "عزل تام للحسابات، قواعد صارمة ضد الهلوسة، وتسليم بشري عند عدم اليقين." },
      ],
    },
    verticals: {
      eyebrow: "03 · القطاعات",
      title: "منصة واحدة، مخصَّصة لقطاعك.",
      sub: "يأتي جوابيفاي بسيناريوهات جاهزة لكل قطاع — اختر قطاعك أثناء الإعداد وسيتكيّف الذكاء الاصطناعي ولوحة التحكم وسير العمل حوله.",
      cta: "أرني المناسب لقطاعي",
    },
    setup: {
      eyebrow: "04 · الإعداد",
      title: "خمس خطوات من التسجيل إلى التشغيل.",
      sub: "معظم الفرق تبدأ بالرد على الزبائن خلال ساعة. بدون برمجة أو ترحيل بيانات.",
      items: [
        { title: "اربط واتساب وانستغرام", desc: "سجّل الدخول عبر ميتا. نحن نتولى إعداد الـ Cloud API الرسمي." },
        { title: "اختر قطاعك", desc: "مطعم، تجارة إلكترونية، رعاية صحية، عقارات، عافية، أو تعليم. كل قطاع يفتح أدوات وقوالب مخصصة." },
        { title: "زوّده بمعرفتك", desc: "ألصق الروابط، ارفع القوائم أو الكتالوجات، أضف صور المنتجات." },
        { title: "اضبط النبرة والرسوم والقواعد", desc: "اختر اللغة الافتراضية، طول الردود، رسوم التوصيل، ساعات العمل، وقواعد التحويل — كلها قابلة للتعديل." },
        { title: "فعّل الرد التلقائي", desc: "عندما تصبح جاهزاً، فعّل المفتاح. سيتولى جوابيفاي خدمة العملاء 24/7." },
      ],
    },
    pricing: {
      eyebrow: "05 · الأسعار",
      title: "خطط تنمو مع صندوق وارد عملك.",
      sub: "ثلاث خطط — Starter وGrowth وEnterprise. جميعها تشمل الذكاء الاصطناعي ودعم متعدد اللغات والصندوق الموحَّد.",
      primary: "ابدأ تجربة 7 أيام مجاناً",
      secondary: "قارن كل الخطط",
    },
    faq: {
      eyebrow: "06 · الأسئلة الشائعة",
      title: "إجابات لكل ما يدور في بالك.",
      items: [
        { q: "ما القنوات التي يدعمها جوابيفاي؟", a: "واتساب بزنس (Meta Cloud API الرسمي) ورسائل انستغرام المباشرة." },
        { q: "هل أحتاج حساب WhatsApp Business API؟", a: "نعم، ونحن نتولى إعداده لك أثناء التهيئة." },
        { q: "ما اللغات التي يتقنها الذكاء الاصطناعي؟", a: "أكثر من 20 لغة ولهجة — عربي (لبناني، مصري، خليجي)، إنجليزي، فرنسي، إسباني، برتغالي، إيطالي، تركي، وغيرها — ويرد بنفس لغة الزبون حتى لو خلطها." },
        { q: "هل يفهم الرسائل الصوتية فعلاً؟", a: "نعم. يفرّغها بنماذج متعددة الوسائط ويرد عليها كأي رسالة نصية." },
        { q: "هل أستطيع تغيير رسوم التوصيل؟", a: "نعم — رسوم التوصيل قابلة للتعديل بالكامل لكل حساب. اضبطها على أي مبلغ (أو صفر) من الإعدادات." },
        { q: "كيف يتعلّم عملي؟", a: "تزوّده بالروابط والملفات والصور والمحادثات السابقة، ويبني قاعدة معرفة خاصة بك." },
        { q: "هل يخترع معلومات؟", a: "لا — قواعد صارمة تمنعه من اختراع تفاصيل أو أسعار. يحوّل للبشر عند الشك." },
        { q: "هل يعمل مع Shopify؟", a: "نعم — مزامنة كاملة في الاتجاهين." },
        { q: "ماذا عن التسليم البشري؟", a: "أي عضو فريق يمكنه استلام المحادثة في أي وقت من الصندوق المشترك." },
        { q: "هل بياناتي خاصة؟", a: "كل حساب معزول على مستوى قاعدة البيانات. محادثاتك لا تُشارك ولا تُستخدم لتدريب حسابات أخرى." },
      ],
    },
    cta: {
      title: "جاهز لتجربته على صندوق وارد عملك؟",
      sub: "ابدأ تجربتك المجانية — بدون بطاقة ائتمان. اربط واتساب خلال دقائق.",
      primary: "ابدأ التجربة المجانية",
      secondary: "العودة للنظرة العامة",
    },
    footer: { tagline: "أتمتة واتساب وانستغرام بالذكاء الاصطناعي للشركات في منطقة MENA وما حولها.", product: "المنتج", resources: "موارد", company: "الشركة" },
  },
  fr: {
    nav: { what: "C'est quoi", features: "Fonctions", verticals: "Secteurs", setup: "Mise en place", pricing: "Tarifs", faq: "FAQ", login: "Connexion", cta: "Démarrer gratuitement" },
    hero: {
      eyebrow: "Guide complet",
      titleA: "Tout ce qu'il faut savoir sur ",
      titleB: "Jawabify",
      sub: "Un regard approfondi sur ce que fait Jawabify, son fonctionnement, à qui il s'adresse et comment le mettre en place. Prenez votre temps — cette page répond à toutes vos questions avant l'inscription.",
      primary: "Essai gratuit",
      secondary: "Lire la présentation",
    },
    what: {
      eyebrow: "01 · Qu'est-ce que Jawabify",
      title: "Un coéquipier IA qui gère votre boîte WhatsApp & Instagram.",
      p1: "Jawabify se connecte à vos comptes WhatsApp Business et Instagram et répond à vos clients 24/7 — en arabe, anglais, français et même dialecte libanais. Il apprend vos produits, services, prix et politiques depuis URLs, documents, images et anciennes conversations.",
      p2: "Au-delà des réponses, Jawabify prend les commandes, réserve les rendez-vous, envoie des catalogues, transcrit les notes vocales, partage des photos produits et transfère à un humain quand il le faut.",
    },
    features: {
      eyebrow: "02 · Fonctionnalités",
      title: "Conçu pour la façon dont les conversations se déroulent vraiment.",
      sub: "Toutes les fonctions ci-dessous sont incluses. Sans plugin ni abonnement supplémentaire.",
      items: [
        { title: "Entraîné sur votre activité", desc: "Ajoutez URLs, PDFs, menus, catalogues et conversations passées. Jawabify construit une base de connaissances privée." },
        { title: "Vraiment multilingue", desc: "Plus de 20 langues et dialectes — arabe (libanais, égyptien, golfe), anglais, français, espagnol et plus — même mélangés dans un seul message." },
        { title: "Transcription vocale", desc: "Les notes vocales sont transcrites en quelques secondes, dans la langue parlée par le client." },
        { title: "Envoie photos & catalogues", desc: "Pousse les bonnes photos produits, menus, épingles de localisation et médias dans la conversation." },
        { title: "Prise de commande", desc: "Détecte l'intention, confirme les articles et applique vos frais de livraison configurables." },
        { title: "Réservations & rappels", desc: "Planifie les rendez-vous, confirme les créneaux et envoie des rappels automatiquement." },
        { title: "Campagnes WhatsApp en masse", desc: "Diffusez des modèles approuvés à des milliers de contacts avec gestion automatique du STOP et suivi de livraison en direct." },
        { title: "Sûr par conception", desc: "Isolation multi-tenant, règles strictes anti-hallucination, et reprise humaine quand l'IA hésite." },
      ],
    },
    verticals: {
      eyebrow: "03 · Secteurs",
      title: "Une plateforme, adaptée à votre secteur.",
      sub: "Jawabify embarque des scénarios prêts à l'emploi pour chaque secteur — choisissez le vôtre à l'onboarding et l'IA, le tableau de bord et les flux s'y adaptent.",
      cta: "Voir pour mon secteur",
    },
    setup: {
      eyebrow: "04 · Mise en place",
      title: "Cinq étapes de l'inscription à l'IA en production.",
      sub: "La plupart des équipes répondent aux clients en moins d'une heure. Sans code, sans migration.",
      items: [
        { title: "Connectez WhatsApp & Instagram", desc: "Connexion via Meta. Nous gérons la configuration officielle Cloud API." },
        { title: "Choisissez votre secteur", desc: "Restaurant, e-commerce, santé, immobilier, bien-être ou éducation. Chacun débloque ses outils." },
        { title: "Alimentez sa connaissance", desc: "Collez vos URLs, importez menus ou catalogues, ajoutez des photos produits." },
        { title: "Réglez le ton, les frais et les règles", desc: "Langue par défaut, longueur des réponses, frais de livraison, horaires, déclencheurs d'escalade — tout est configurable." },
        { title: "Activez la réponse auto", desc: "Quand vous êtes prêt, basculez l'interrupteur. Jawabify prend le relais 24/7." },
      ],
    },
    pricing: {
      eyebrow: "05 · Tarifs",
      title: "Des forfaits qui évoluent avec votre boîte.",
      sub: "Trois forfaits — Starter, Growth et Enterprise. Tous incluent l'IA, le multilingue et la boîte partagée.",
      primary: "Démarrer 7 jours gratuits",
      secondary: "Comparer les forfaits",
    },
    faq: {
      eyebrow: "06 · FAQ",
      title: "Vos questions, nos réponses.",
      items: [
        { q: "Quels canaux Jawabify prend-il en charge ?", a: "WhatsApp Business (Meta Cloud API officiel) et Instagram Direct." },
        { q: "Faut-il un compte WhatsApp Business API ?", a: "Oui, et nous le configurons pour vous lors de l'onboarding." },
        { q: "Quelles langues sont gérées ?", a: "Plus de 20 langues et dialectes — arabe (libanais, égyptien, golfe), anglais, français, espagnol, portugais, italien, turc, et plus — il répond dans la langue du client, même mélangée." },
        { q: "Comprend-il vraiment les vocaux ?", a: "Oui. Transcription en quelques secondes via modèles multimodaux." },
        { q: "Puis-je changer les frais de livraison ?", a: "Oui — les frais sont entièrement configurables par compte. Mettez le montant que vous voulez (ou zéro)." },
        { q: "Comment apprend-il mon activité ?", a: "URLs, PDFs, images et anciennes conversations. Base de connaissances privée à votre tenant." },
        { q: "Invente-t-il des informations ?", a: "Non — règles strictes anti-hallucination. Il escalade à un humain en cas de doute." },
        { q: "Fonctionne-t-il avec Shopify ?", a: "Oui — synchronisation bidirectionnelle complète." },
        { q: "Et la reprise humaine ?", a: "N'importe quel membre peut reprendre une conversation à tout moment." },
        { q: "Mes données sont-elles privées ?", a: "Chaque tenant est isolé au niveau base de données. Vos données ne servent jamais à entraîner d'autres comptes." },
      ],
    },
    cta: {
      title: "Prêt à le voir sur votre propre boîte ?",
      sub: "Essai gratuit — sans carte bancaire. Connectez WhatsApp en quelques minutes.",
      primary: "Essai gratuit",
      secondary: "Retour à l'aperçu",
    },
    footer: { tagline: "Automatisation WhatsApp & Instagram par IA pour les entreprises de la région MENA et au-delà.", product: "Produit", resources: "Ressources", company: "Société" },
  },
};

const FEATURE_ICONS = [Brain, Languages, Mic, ImageIcon, ShoppingBag, CalendarCheck, Megaphone, Shield];
const SETUP_ICONS = [Plug, Sparkles, Upload, SettingsIcon, Rocket];

const VERTICAL_BLURBS_EN: Record<string, string[]> = {
  ecommerce: ["Auto-confirms orders", "Sends product photos", "Shopify two-way sync", "Configurable delivery fee"],
  restaurant: ["Menu on WhatsApp", "Bills fired to kitchen", "Table reservations", "Modifiers & combos"],
  real_estate: ["Qualifies leads", "Books viewings", "Routes to agents", "Listing image search"],
  wellness: ["Books appointments", "Auto reminders", "Reschedule flow", "Staff calendar sync"],
  healthcare: ["Symptom triage", "Appointment booking", "Lab follow-ups", "Always escalates urgent"],
  education: ["Class info & schedules", "Registration help", "Parent FAQs", "24/7 multilingual"],
};
const VERTICAL_BLURBS_AR: Record<string, string[]> = {
  ecommerce: ["تأكيد الطلبات تلقائياً", "إرسال صور المنتجات", "مزامنة Shopify ثنائية", "رسوم توصيل قابلة للتعديل"],
  restaurant: ["القائمة على واتساب", "الفواتير للمطبخ", "حجوزات الطاولات", "إضافات وعروض"],
  real_estate: ["تأهيل العملاء", "حجز المعاينات", "توجيه للوكلاء", "بحث بصور العقارات"],
  wellness: ["حجز المواعيد", "تذكيرات تلقائية", "إعادة الجدولة", "مزامنة تقويم الموظفين"],
  healthcare: ["فرز الأعراض", "حجز المواعيد", "متابعة المختبر", "تصعيد الحالات الطارئة"],
  education: ["معلومات الصفوف", "مساعدة التسجيل", "أسئلة أولياء الأمور", "24/7 متعدد اللغات"],
};
const VERTICAL_BLURBS_FR: Record<string, string[]> = {
  ecommerce: ["Confirmation auto", "Envoi photos produits", "Sync Shopify", "Frais de livraison réglables"],
  restaurant: ["Menu sur WhatsApp", "Tickets en cuisine", "Réservations de table", "Options & combos"],
  real_estate: ["Qualification leads", "Réservation visites", "Routage agents", "Recherche par image"],
  wellness: ["Réservation RDV", "Rappels auto", "Reprogrammation", "Sync agenda équipe"],
  healthcare: ["Triage symptômes", "Prise de RDV", "Suivi labo", "Escalade des urgences"],
  education: ["Infos & horaires", "Aide inscription", "FAQ parents", "24/7 multilingue"],
};
const VERTICAL_BLURBS: Record<ContentLang, Record<string, string[]>> = { en: VERTICAL_BLURBS_EN, ar: VERTICAL_BLURBS_AR, fr: VERTICAL_BLURBS_FR };

const STATS_EN = [
  { value: "6", label: "industries supported" },
  { value: "20+", label: "languages, mixed" },
  { value: "<60s", label: "average response" },
  { value: "24/7", label: "always online" },
];
const STATS_AR = [
  { value: "6", label: "قطاعات مدعومة" },
  { value: "+20", label: "لغات مختلطة" },
  { value: "<60ث", label: "متوسط الرد" },
  { value: "24/7", label: "دائماً متصل" },
];
const STATS_FR = [
  { value: "6", label: "secteurs supportés" },
  { value: "20+", label: "langues mélangées" },
  { value: "<60s", label: "réponse moyenne" },
  { value: "24/7", label: "toujours en ligne" },
];
const STATS: Record<ContentLang, typeof STATS_EN> = { en: STATS_EN, ar: STATS_AR, fr: STATS_FR };

interface SectionProps { lang: Lang; t: Dict }

const LangSwitcher = ({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) => {
  const current = LANGS.find((l) => l.code === lang)!;
  return (
    <div className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-card/80 px-2.5 backdrop-blur">
      <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
        <SelectTrigger className="h-7 w-auto gap-1 border-0 bg-transparent px-1 text-xs font-semibold shadow-none focus:ring-0 focus:ring-offset-0">
          <span className="whitespace-nowrap">{current.short}</span>
        </SelectTrigger>
        <SelectContent align="end" className="w-[220px]">
          {LANGS.map((l) => (
            <SelectItem key={l.code} value={l.code} className="py-2">
              <span className="flex w-full items-center justify-between gap-6">
                <span className="font-medium">{l.label}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{l.short}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};


const Nav = ({ lang, setLang, t }: SectionProps & { setLang: (l: Lang) => void }) => (
  <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
      <Link to="/" className="text-2xl font-extrabold tracking-tight">
        jawab<span className="text-primary">ify</span>
      </Link>
      <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground lg:flex">
        <a href="#what" className="hover:text-foreground">{t.nav.what}</a>
        <a href="#features" className="hover:text-foreground">{t.nav.features}</a>
        <a href="#verticals" className="hover:text-foreground">{t.nav.verticals}</a>
        <a href="#setup" className="hover:text-foreground">{t.nav.setup}</a>
        <a href="#pricing" className="hover:text-foreground">{t.nav.pricing}</a>
        <a href="#faq" className="hover:text-foreground">{t.nav.faq}</a>
      </nav>
      <div className="flex items-center gap-2">
        <div className="hidden sm:block"><LangSwitcher lang={lang} setLang={setLang} /></div>
        <Link to="/auth" replace onClick={() => trackLead({ content_name: "Info Nav Login" })}>
          <Button variant="outline" className="rounded-full">{t.nav.login}</Button>
        </Link>
        <Link to="/auth" replace className="hidden md:block" onClick={() => trackStartTrial({ content_name: "Info Nav CTA" })}>
          <Button className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
            {t.nav.cta}
          </Button>
        </Link>
      </div>
    </div>
    <div className="border-t bg-background/60 px-4 py-2 sm:hidden">
      <LangSwitcher lang={lang} setLang={setLang} />
    </div>
  </header>
);

const HERO_CHECKS: Record<ContentLang, string[]> = {
  en: ["7-day free trial", "Cancel anytime", "Live in minutes"],
  ar: ["تجربة 7 أيام مجاناً", "إلغاء في أي وقت", "تشغيل خلال دقائق"],
  fr: ["Essai gratuit 7 jours", "Annulation à tout moment", "En ligne en quelques minutes"],
};

const Hero = ({ lang, t }: SectionProps) => {
  const checks = HERO_CHECKS[contentLang(lang)];
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-[#06120f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.35),transparent_55%),radial-gradient(ellipse_at_bottom_right,hsl(var(--primary)/0.20),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {t.hero.eyebrow}
          </div>
          <h1 className="mt-5 text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            {t.hero.titleA}
            <span className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
              {t.hero.titleB}
            </span>
            .
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/70 sm:text-xl">{t.hero.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth" replace>
              <Button size="lg" className="rounded-full bg-primary px-7 text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90">
                {t.hero.primary} <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <a href="#what">
              <Button size="lg" variant="outline" className="rounded-full border-white/20 bg-white/5 px-7 text-white hover:bg-white/10 hover:text-white">
                {t.hero.secondary}
              </Button>
            </a>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/70">
            {checks.map((c) => (
              <span key={c} className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" /> {c}
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/85 backdrop-blur">
              <span className="text-base">⓵</span> Meta Business Partner
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/85 backdrop-blur">
              <ShoppingBag className="h-3.5 w-3.5 text-primary" /> Shopify Official App
            </span>
          </div>
        </div>
        <div className="relative hidden lg:block">
          <div className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-primary/30 via-primary/10 to-transparent blur-3xl" />
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl shadow-primary/20">
            <img src={heroPhone} alt="Jawabify AI replying on WhatsApp" width={1536} height={1024} className="block h-auto w-full" />
          </div>
        </div>
      </div>
    </section>
  );
};

const StatStrip = ({ lang }: { lang: Lang }) => (
  <section className="border-b border-border/60 bg-gradient-to-b from-primary/5 to-transparent">
    <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-10 sm:grid-cols-4 sm:px-6">
      {STATS[contentLang(lang)].map((s) => (
        <div key={s.label} className="text-center sm:text-left">
          <div className="text-3xl font-extrabold text-primary sm:text-4xl">{s.value}</div>
          <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground sm:text-sm">{s.label}</div>
        </div>
      ))}
    </div>
  </section>
);

const What = ({ t }: SectionProps) => (
  <section id="what" className="relative border-b border-border/60 py-20 sm:py-28">
    <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
      <p className="text-sm font-bold uppercase tracking-widest text-primary">{t.what.eyebrow}</p>
      <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{t.what.title}</h2>
      <div className="mt-8 space-y-5 text-lg leading-relaxed text-muted-foreground">
        <p>{t.what.p1}</p>
        <p>{t.what.p2}</p>
      </div>
    </div>
  </section>
);

const Features = ({ t }: SectionProps) => (
  <section id="features" className="relative border-b border-border/60 bg-muted/30 py-20 sm:py-28">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.08),transparent_50%)]" />
    <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-widest text-primary">{t.features.eyebrow}</p>
      <h2 className="mt-3 max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">{t.features.title}</h2>
      <p className="mt-4 max-w-2xl text-muted-foreground">{t.features.sub}</p>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {t.features.items.map((f, i) => {
          const Icon = FEATURE_ICONS[i] ?? Sparkles;
          return (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border bg-card p-6 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition group-hover:opacity-100" />
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/10">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold leading-snug">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

const Verticals = ({ lang, t }: SectionProps) => (
  <section id="verticals" className="relative border-b border-border/60 py-20 sm:py-28">
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-widest text-primary">{t.verticals.eyebrow}</p>
      <h2 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">{t.verticals.title}</h2>
      <p className="mt-4 max-w-2xl text-muted-foreground">{t.verticals.sub}</p>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {VERTICALS.map((v) => (
          <div
            key={v.id}
            className="group relative overflow-hidden rounded-3xl border bg-card p-7 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition group-hover:bg-primary/10" />
            <div className="relative">
              <div className="text-4xl">{v.emoji}</div>
              <h3 className="mt-4 text-2xl font-extrabold">{v.label}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{v.tagline}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {(VERTICAL_BLURBS[contentLang(lang)][v.id] ?? []).map((b) => (
                  <li key={b} className="flex gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <Link to="/auth" replace>
          <Button size="lg" className="rounded-full bg-primary px-7 hover:bg-primary/90">
            {t.verticals.cta} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  </section>
);

const Setup = ({ t }: SectionProps) => (
  <section id="setup" className="relative border-b border-border/60 bg-muted/30 py-20 sm:py-28">
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-widest text-primary">{t.setup.eyebrow}</p>
      <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{t.setup.title}</h2>
      <p className="mt-4 max-w-2xl text-muted-foreground">{t.setup.sub}</p>
      <div className="relative mt-12 space-y-4">
        <div className="pointer-events-none absolute left-[27px] top-6 bottom-6 hidden w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent sm:block" />
        {t.setup.items.map((s, i) => {
          const Icon = SETUP_ICONS[i] ?? Rocket;
          return (
            <div key={s.title} className="relative flex items-start gap-5 rounded-2xl border bg-card p-6">
              <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/15">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3">
                  <span className="text-sm font-bold text-primary">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="text-xl font-bold">{s.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

// ============ Pricing tiers ============
type Tier = {
  id: string;
  name: string;
  badge?: string;
  oldPrice?: string;
  price: string;
  priceSuffix?: string;
  tagline: string;
  features: string[];
  cta: string;
  highlight?: boolean;
  custom?: boolean;
};

const PRICING_COPY: Record<ContentLang, { eyebrow: string; title: string; sub: string; save: string; mostPopular: string; tiers: Tier[] }> = {
  en: {
    eyebrow: "05 · Pricing",
    title: "Pays for Itself in Days",
    sub: "Start free for 7 days. No credit card. Cancel anytime.",
    save: "Launch offer",
    mostPopular: "Most popular",
    tiers: [
      {
        id: "starter",
        name: "Starter",
        oldPrice: "$90",
        price: "$45",
        priceSuffix: "/month",
        tagline: "Everything you need to start replying automatically.",
        features: [
          "Up to 1,000 orders / month",
          "WhatsApp AI auto-reply",
          "Multilingual (Arabic, English, French)",
          "Voice note transcription",
          "Shared inbox with order context",
          "Shopify two-way sync",
        ],
        cta: "Start free trial",
      },
      {
        id: "growth",
        name: "Growth",
        badge: "Most popular",
        oldPrice: "$140",
        price: "$90",
        priceSuffix: "/month",
        tagline: "Scale without limits — built for serious operators.",
        features: [
          "Unlimited orders",
          "Bulk campaigns & broadcasts",
          "Automated order confirmation notification",
          "Priority support",
          "Everything in Starter",
        ],
        cta: "Start free trial",
        highlight: true,
      },
      {
        id: "enterprise",
        name: "Enterprise",
        price: "Custom",
        tagline: "For agencies, multi-brand and high-volume operations.",
        features: [
          "Custom volume & SLAs",
          "Dedicated onboarding manager",
          "Multi-tenant / multi-brand setup",
          "Custom integrations & API access",
          "Instagram AI auto-reply",
          "White-label & co-branding",
          "Security review & DPA",
        ],
        cta: "Contact sales",
        custom: true,
      },
    ],
  },
  ar: {
    eyebrow: "05 · الأسعار",
    title: "أسعار بسيطة. قيمة حقيقية.",
    sub: "ثلاث خطط. جميعها تشمل الذكاء الاصطناعي ودعم متعدد اللغات والصندوق الموحَّد. عرض الإطلاق ساري — احجز السعر قبل انتهائه.",
    save: "عرض الإطلاق",
    mostPopular: "الأكثر شعبية",
    tiers: [
      {
        id: "starter",
        name: "البداية",
        oldPrice: "$90",
        price: "$45",
        priceSuffix: "/شهر",
        tagline: "كل ما تحتاجه لتبدأ الردود التلقائية.",
        features: [
          "حتى 1000 طلب / شهرياً",
          "رد آلي لواتساب",
          "متعدد اللغات (عربي، إنجليزي، فرنسي)",
          "تفريغ الرسائل الصوتية",
          "صندوق مشترك مع سياق الطلب",
          "رسوم توصيل قابلة للتعديل",
          "مزامنة Shopify ثنائية",
        ],
        cta: "ابدأ التجربة المجانية",
      },
      {
        id: "growth",
        name: "النمو",
        badge: "الأكثر شعبية",
        oldPrice: "$140",
        price: "$90",
        priceSuffix: "/شهر",
        tagline: "توسّع بلا حدود — مصمَّم للمحترفين.",
        features: [
          "طلبات غير محدودة",
          "حملات وإرسال جماعي",
          "إشعار تأكيد الطلبات تلقائياً",
          "دعم ذو أولوية",
          "كل ما في خطة البداية",
        ],
        cta: "ابدأ التجربة المجانية",
        highlight: true,
      },
      {
        id: "enterprise",
        name: "المؤسسات",
        price: "حسب الطلب",
        tagline: "للوكالات والعلامات المتعددة والعمليات الكبيرة.",
        features: [
          "حجم واتفاقيات SLA مخصصة",
          "مدير تهيئة مخصص",
          "إعداد متعدد العلامات",
          "تكاملات مخصصة ووصول API",
          "رد آلي على انستغرام",
          "حلول White-label",
          "مراجعة أمنية واتفاقية DPA",
        ],
        cta: "تواصل مع المبيعات",
        custom: true,
      },
    ],
  },
  fr: {
    eyebrow: "05 · Tarifs",
    title: "Tarification simple. Vraie valeur.",
    sub: "Trois forfaits. Tous incluent l'IA, le multilingue et la boîte partagée. Offre de lancement en cours — sécurisez le tarif avant la fin.",
    save: "Offre de lancement",
    mostPopular: "Le plus populaire",
    tiers: [
      {
        id: "starter",
        name: "Starter",
        oldPrice: "$90",
        price: "$45",
        priceSuffix: "/mois",
        tagline: "Tout pour démarrer les réponses automatiques.",
        features: [
          "Jusqu'à 1 000 commandes / mois",
          "Réponses auto WhatsApp",
          "Multilingue (arabe, anglais, français)",
          "Transcription des vocaux",
          "Boîte partagée avec contexte commande",
          "Frais de livraison configurables",
          "Synchronisation Shopify bidirectionnelle",
        ],
        cta: "Essai gratuit",
      },
      {
        id: "growth",
        name: "Growth",
        badge: "Le plus populaire",
        oldPrice: "$140",
        price: "$90",
        priceSuffix: "/mois",
        tagline: "Croissez sans limites — pensé pour les pros.",
        features: [
          "Commandes illimitées",
          "Campagnes et diffusion en masse",
          "Notification de confirmation de commande automatisée",
          "Support prioritaire",
          "Tout le contenu de Starter",
        ],
        cta: "Essai gratuit",
        highlight: true,
      },
      {
        id: "enterprise",
        name: "Enterprise",
        price: "Sur mesure",
        tagline: "Pour agences, multi-marques et gros volumes.",
        features: [
          "Volume & SLA sur mesure",
          "Onboarding dédié",
          "Multi-tenant / multi-marques",
          "Intégrations & accès API",
          "Réponses auto Instagram",
          "White-label & co-branding",
          "Revue sécurité & DPA",
        ],
        cta: "Contacter les ventes",
        custom: true,
      },
    ],
  },
};

const Pricing = ({ lang }: { lang: Lang }) => {
  const c = PRICING_COPY[contentLang(lang)];
  return (
    <section id="pricing" className="relative border-b border-border/60 py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.10),transparent_60%)]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-primary">{c.eyebrow}</p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{c.title}</h2>
          <p className="mx-auto mt-4 text-muted-foreground">{c.sub}</p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {c.tiers.map((tier) => {
            const Icon = tier.custom ? Crown : tier.highlight ? Zap : Sparkles;
            return (
              <div
                key={tier.id}
                className={`relative flex flex-col overflow-hidden rounded-3xl border p-8 transition ${
                  tier.highlight
                    ? "border-primary/50 bg-gradient-to-b from-primary/10 via-card to-card shadow-2xl shadow-primary/10 lg:-translate-y-2"
                    : "bg-card hover:border-primary/30"
                }`}
              >
                {tier.badge && (
                  <div className="absolute right-6 top-6 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-md">
                    <Star className="h-3 w-3 fill-current" /> {tier.badge}
                  </div>
                )}
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/15">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-2xl font-extrabold">{tier.name}</h3>
                <p className="mt-2 min-h-[2.5rem] text-sm text-muted-foreground">{tier.tagline}</p>

                <div className="mt-6 flex items-baseline gap-3">
                  {tier.oldPrice && (
                    <span className="text-2xl font-semibold text-muted-foreground/70 line-through decoration-destructive/70 decoration-2">
                      {tier.oldPrice}
                    </span>
                  )}
                  <span className={`text-5xl font-extrabold tracking-tight ${tier.custom ? "" : "text-primary"}`}>
                    {tier.price}
                  </span>
                  {tier.priceSuffix && (
                    <span className="text-sm font-medium text-muted-foreground">{tier.priceSuffix}</span>
                  )}
                </div>
                {tier.oldPrice && (
                  <div className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                    <Sparkles className="h-3 w-3" /> {c.save}
                  </div>
                )}

                <ul className="mt-7 flex-1 space-y-3 text-sm">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link to={tier.custom ? "/" : "/auth"} className="mt-8 block">
                  <Button
                    className={`w-full rounded-full ${
                      tier.highlight
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : tier.custom
                          ? "bg-foreground text-background hover:bg-foreground/90"
                          : ""
                    }`}
                    variant={tier.highlight || tier.custom ? "default" : "outline"}
                    size="lg"
                  >
                    {tier.cta} <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ============ Showcase ============
const SHOWCASE_COPY: Record<ContentLang, { eyebrow: string; title: string; sub: string }> = {
  en: {
    eyebrow: "Inside Jawabify",
    title: "Cut response time from hours to seconds.",
    sub: "Your team stops switching between WhatsApp, Instagram and call apps. Every message lands in one inbox with the customer's full order history right next to it — so the very first reply already has the answer.",
  },
  ar: {
    eyebrow: "من داخل جوابيفاي",
    title: "اختصر وقت الرد من ساعات إلى ثوانٍ.",
    sub: "فريقك لا يتنقل بعد اليوم بين واتساب وانستغرام وتطبيقات الاتصال. كل رسالة تصل إلى صندوق واحد مع تاريخ طلبات الزبون بجانبها — ليكون أول رد محمّلاً بالإجابة.",
  },
  fr: {
    eyebrow: "Dans Jawabify",
    title: "Passez d'heures à secondes de réponse.",
    sub: "Votre équipe arrête de jongler entre WhatsApp, Instagram et les apps d'appel. Chaque message arrive dans une seule boîte avec l'historique complet du client à côté — la toute première réponse a déjà la bonne information.",
  },
};

const Showcase = ({ lang }: { lang: Lang }) => {
  const c = SHOWCASE_COPY[contentLang(lang)];
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-background via-primary/5 to-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-primary">09 · {c.eyebrow}</p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{c.title}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-muted-foreground">{c.sub}</p>
        </div>
        <div className="relative mx-auto mt-14 max-w-6xl">
          <div className="pointer-events-none absolute -inset-x-10 -top-10 -bottom-10 rounded-[3rem] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-3xl" />
          <div className="relative overflow-hidden rounded-3xl border bg-card shadow-2xl shadow-primary/10">
            <img
              src={inboxMockup}
              alt="Jawabify unified WhatsApp and Instagram inbox dashboard"
              loading="lazy"
              width={1920}
              height={1080}
              className="block h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

// ============ Testimonials ============
const TESTIMONIALS_COPY: Record<ContentLang, { eyebrow: string; title: string; rating: string; based: string; items: { quote: string; name: string; role: string }[] }> = {
  en: {
    eyebrow: "07 · Loved by operators",
    title: "Rated 4.9 / 5 by the teams using it daily.",
    rating: "4.9 / 5",
    based: "based on 240+ reviews",
    items: [
      { quote: "We went from missing half our WhatsApp messages to a fully covered inbox 24/7. Orders just keep landing.", name: "Karim B.", role: "Owner, Beirut concept store" },
      { quote: "The Arabic-Lebanese handling is the real deal. Our customers think they're chatting with a human.", name: "Nour H.", role: "Operations lead, restaurant chain" },
      { quote: "Shopify sync alone paid for the plan. Setup took us less than an hour with zero developer help.", name: "Tarek M.", role: "Founder, DTC apparel brand" },
    ],
  },
  ar: {
    eyebrow: "07 · يحبه أصحاب الأعمال",
    title: "تقييم 4.9 / 5 من الفرق التي تستخدمه يومياً.",
    rating: "4.9 / 5",
    based: "بناءً على أكثر من 240 تقييم",
    items: [
      { quote: "كنا نضيّع نصف رسائل واتساب، الآن الصندوق مغطّى 24/7 والطلبات تتوالى.", name: "كريم ب.", role: "صاحب متجر، بيروت" },
      { quote: "التعامل مع العربية واللبنانية ممتاز فعلاً. الزبائن يظنّون أنهم يتحدثون مع موظف بشري.", name: "نور ح.", role: "مديرة عمليات، سلسلة مطاعم" },
      { quote: "مزامنة Shopify وحدها تغطي ثمن الخطة. الإعداد استغرق أقل من ساعة بدون مطوّر.", name: "طارق م.", role: "مؤسس، علامة ملابس DTC" },
    ],
  },
  fr: {
    eyebrow: "07 · Adoré par les opérateurs",
    title: "Noté 4.9 / 5 par les équipes qui l'utilisent au quotidien.",
    rating: "4.9 / 5",
    based: "sur plus de 240 avis",
    items: [
      { quote: "On manquait la moitié des messages WhatsApp. Maintenant la boîte est couverte 24/7 et les commandes tombent toutes seules.", name: "Karim B.", role: "Fondateur, concept store Beyrouth" },
      { quote: "La gestion arabe-libanais est bluffante. Nos clients pensent parler à un humain.", name: "Nour H.", role: "Responsable ops, chaîne de restaurants" },
      { quote: "La sync Shopify à elle seule rentabilise l'abonnement. Setup en moins d'une heure sans dev.", name: "Tarek M.", role: "Fondateur, marque DTC textile" },
    ],
  },
};

const Testimonials = ({ lang }: { lang: Lang }) => {
  const c = TESTIMONIALS_COPY[contentLang(lang)];
  return (
    <section className="relative border-b border-border/60 bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-widest text-primary">{c.eyebrow}</p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{c.title}</h2>
          </div>
          <div className="inline-flex items-center gap-3 rounded-2xl border bg-card px-5 py-3 shadow-sm">
            <div className="flex">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <div>
              <div className="text-lg font-extrabold leading-none">{c.rating}</div>
              <div className="mt-1 text-xs text-muted-foreground">{c.based}</div>
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {c.items.map((it, i) => (
            <div key={i} className="flex flex-col rounded-2xl border bg-card p-7">
              <div className="flex gap-0.5">
                {[0, 1, 2, 3, 4].map((s) => (
                  <Star key={s} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="mt-5 flex-1 text-base leading-relaxed">"{it.quote}"</p>
              <div className="mt-6 flex items-center gap-3 border-t pt-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {it.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold">{it.name}</div>
                  <div className="text-xs text-muted-foreground">{it.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============ Referral ============
const REFERRAL_COPY: Record<ContentLang, { eyebrow: string; title: string; sub: string; cta: string; points: string[] }> = {
  en: {
    eyebrow: "08 · Refer & earn",
    title: "Get one month free when you share Jawabify.",
    sub: "Share your unique link. When a business signs up and activates a paid plan, you get a full month free — added straight to your subscription.",
    cta: "Get my referral link",
    points: ["1 full month free per signup", "Works on all plans", "Credited automatically"],
  },
  ar: {
    eyebrow: "08 · شارك واربح",
    title: "احصل على شهر مجاني عند مشاركة جوابيفاي.",
    sub: "شارك رابطك الفريد. عندما يسجّل عمل تجاري ويفعّل خطة مدفوعة، تحصل على شهر كامل مجاناً يُضاف مباشرةً إلى اشتراكك.",
    cta: "احصل على رابطي",
    points: ["شهر كامل مجاناً عن كل تسجيل", "متاح على جميع الخطط", "يُضاف تلقائياً"],
  },
  fr: {
    eyebrow: "08 · Parrainage",
    title: "Un mois offert quand vous partagez Jawabify.",
    sub: "Partagez votre lien unique. Quand une entreprise s'inscrit et active un forfait payant, vous recevez un mois complet offert ajouté à votre abonnement.",
    cta: "Obtenir mon lien",
    points: ["1 mois entier par inscription", "Sur tous les forfaits", "Crédité automatiquement"],
  },
};

const Referral = ({ lang }: { lang: Lang }) => {
  const c = REFERRAL_COPY[contentLang(lang)];
  return (
    <section className="border-b border-border/60 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/15 via-card to-card p-10 sm:p-14">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative grid items-center gap-10 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-primary">{c.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{c.title}</h2>
              <p className="mt-5 max-w-xl text-muted-foreground">{c.sub}</p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-3">
                {c.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link to="/auth" replace>
                  <Button size="lg" className="rounded-full bg-primary px-7 hover:bg-primary/90">
                    <Share2 className="mr-2 h-4 w-4" /> {c.cta}
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="mx-auto flex max-w-xs flex-col items-center rounded-3xl border bg-card p-8 text-center shadow-xl">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Gift className="h-8 w-8" />
                </div>
                <div className="mt-5 text-5xl font-extrabold text-primary">+1</div>
                <div className="mt-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {lang === "ar" ? "شهر مجاني" : lang === "fr" ? "Mois offert" : "Free month"}
                </div>
                <div className="mt-4 text-xs text-muted-foreground">
                  {lang === "ar" ? "عن كل إحالة ناجحة" : lang === "fr" ? "Par parrainage réussi" : "Per successful referral"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};


const FAQ = ({ t }: SectionProps) => (
  <section id="faq" className="border-b border-border/60 bg-muted/30 py-20 sm:py-28">
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-widest text-primary">{t.faq.eyebrow}</p>
      <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{t.faq.title}</h2>
      <Accordion type="single" collapsible className="mt-10">
        {t.faq.items.map((f, i) => (
          <AccordionItem key={i} value={`item-${i}`} className="border-b">
            <AccordionTrigger className="text-left text-base font-semibold hover:no-underline">{f.q}</AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
);

const CTA = ({ t }: SectionProps) => (
  <section className="py-20 sm:py-24">
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background p-12 text-center sm:p-16">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-60 w-60 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{t.cta.title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{t.cta.sub}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth" replace onClick={() => trackStartTrial({ content_name: "Info CTA Primary" })}>
              <Button size="lg" className="rounded-full bg-primary px-8 hover:bg-primary/90">
                {t.cta.primary} <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/" onClick={() => trackViewContent({ content_name: "Info CTA Secondary - Home" })}>
              <Button size="lg" variant="outline" className="rounded-full px-8">{t.cta.secondary}</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const Footer = ({ t }: SectionProps) => (
  <footer className="border-t border-border/60 py-14">
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="grid gap-10 md:grid-cols-4">
        <div>
          <div className="text-2xl font-extrabold">jawab<span className="text-primary">ify</span></div>
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">{t.footer.tagline}</p>
        </div>
        <div>
          <h4 className="font-bold">{t.footer.product}</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li><a href="#features" className="hover:text-foreground">{t.nav.features}</a></li>
            <li><a href="#setup" className="hover:text-foreground">{t.nav.setup}</a></li>
            <li><a href="#pricing" className="hover:text-foreground">{t.nav.pricing}</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold">{t.footer.resources}</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li><a href="#verticals" className="hover:text-foreground">{t.nav.verticals}</a></li>
            <li><a href="#faq" className="hover:text-foreground">{t.nav.faq}</a></li>
            <li><Link to="/" className="hover:text-foreground">Home</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold">{t.footer.company}</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li><a href="#" className="hover:text-foreground">About</a></li>
            <li><a href="#" className="hover:text-foreground">Blog</a></li>
            <li><a href="#" className="hover:text-foreground">Contact</a></li>
          </ul>
        </div>
      </div>
      <div className="mt-12 border-t pt-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Jawabify. · <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
      </div>
    </div>
  </footer>
);

// ============ Replaces (what Jawabify makes redundant) ============
const REPLACES_COPY: Record<ContentLang, { eyebrow: string; title: string; items: { title: string; desc: string }[] }> = {
  en: {
    eyebrow: "Also replaces",
    title: "The stack you can finally retire.",
    items: [
      { title: "Call centre tool", desc: "Order confirmations, scripts, auto-assign" },
      { title: "Helpdesk / inbox", desc: "WhatsApp, Instagram, email in one place" },
      { title: "Order confirmation app", desc: "Auto-confirm on WhatsApp, no human needed" },
      { title: "WhatsApp blast tool", desc: "Campaigns, broadcasts, segments" },
    ],
  },
  ar: {
    eyebrow: "يستبدل أيضاً",
    title: "أدوات تستطيع التخلّي عنها أخيراً.",
    items: [
      { title: "أداة مركز الاتصال", desc: "تأكيدات الطلبات، السكريبتات، التوزيع التلقائي" },
      { title: "صندوق الدعم", desc: "واتساب وانستغرام والإيميل في مكان واحد" },
      { title: "تطبيق تأكيد الطلبات", desc: "تأكيد آلي على واتساب بدون موظف" },
      { title: "أداة الحملات على واتساب", desc: "حملات، إرسال جماعي، شرائح" },
    ],
  },
  fr: {
    eyebrow: "Remplace aussi",
    title: "La stack que vous pouvez enfin retirer.",
    items: [
      { title: "Outil de call center", desc: "Confirmations, scripts, attribution auto" },
      { title: "Helpdesk / boîte", desc: "WhatsApp, Instagram, email au même endroit" },
      { title: "App de confirmation", desc: "Confirmation auto sur WhatsApp, sans humain" },
      { title: "Outil de campagnes WhatsApp", desc: "Campagnes, diffusion, segments" },
    ],
  },
};
const REPLACES_ICONS = [Headphones, Inbox, PhoneOff, RefreshCw];

const Replaces = ({ lang }: { lang: Lang }) => {
  const c = REPLACES_COPY[contentLang(lang)];
  return (
    <section className="border-b border-border/60 bg-muted/30 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="text-sm font-bold uppercase tracking-widest text-primary">{c.eyebrow}</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">{c.title}</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.items.map((it, i) => {
            const Icon = REPLACES_ICONS[i] ?? Inbox;
            return (
              <div key={it.title} className="group rounded-2xl border bg-card p-6">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-primary line-through decoration-primary/70 decoration-2">
                  {it.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{it.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ============ Confirm orders spotlight ============
const CONFIRM_COPY: Record<ContentLang, { eyebrow: string; title: string; sub: string; points: string[] }> = {
  en: {
    eyebrow: "01 · Confirmation",
    title: "Confirm orders without making a single call.",
    sub: "Send a WhatsApp confirmation the moment an order is placed. Customers reply in seconds — no missed calls, no lost orders, no idle agents.",
    points: [
      "WhatsApp confirmation costs a fraction of a phone call",
      "Runs 24/7 — even when your call center is closed",
      "Reaches customers who never pick up the phone",
    ],
  },
  ar: {
    eyebrow: "01 · التأكيد",
    title: "أكّد الطلبات بدون إجراء أي مكالمة.",
    sub: "أرسل تأكيداً على واتساب لحظة وصول الطلب. الزبائن يردّون خلال ثوانٍ — بدون مكالمات ضائعة أو طلبات مفقودة أو موظفين متوقفين.",
    points: [
      "تأكيد واتساب يكلّف جزءاً بسيطاً من ثمن المكالمة",
      "يعمل 24/7 — حتى عند إغلاق مركز الاتصال",
      "يصل إلى الزبائن الذين لا يجيبون على الهاتف",
    ],
  },
  fr: {
    eyebrow: "01 · Confirmation",
    title: "Confirmez les commandes sans passer un seul appel.",
    sub: "Envoyez une confirmation WhatsApp dès la commande passée. Les clients répondent en secondes — pas d'appels manqués, pas de commandes perdues.",
    points: [
      "La confirmation WhatsApp coûte une fraction d'un appel",
      "Tourne 24/7 — même quand le call center est fermé",
      "Atteint les clients qui ne décrochent jamais",
    ],
  },
};

const ConfirmSpotlight = ({ lang }: { lang: Lang }) => {
  const c = CONFIRM_COPY[contentLang(lang)];
  return (
    <section className="border-b border-border/60 py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div className="relative">
          <div className="pointer-events-none absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-3xl" />
          <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-xl">
            <img src={confirmOrders} alt="WhatsApp order confirmation on a phone" loading="lazy" className="h-auto w-full rounded-2xl" />
          </div>
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-primary">{c.eyebrow}</p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{c.title}</h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{c.sub}</p>
          <ul className="mt-8 space-y-3">
            {c.points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-base">
                <Check className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

// ============ Risk-free guarantee (Free setup / 7-day money back) ============
const RISKFREE_COPY: Record<ContentLang, {
  eyebrow: string; titleA: string; titleB: string; sub: string;
  cardEyebrow: string; oldPrice: string; freeLabel: string; limited: string;
  bullets: string[]; primary: string; secondary: string;
  rating: string; ratingNote: string; partnerMeta: string; partnerShopify: string; quote: string;
}> = {
  en: {
    eyebrow: "100% risk-free",
    titleA: "Free setup.",
    titleB: "Love it in 7 days — or your money back.",
    sub: "Confirm more orders. Cut returns. Keep more margin. Our team builds it all for you — and you keep your store, carriers, and WhatsApp number. Nothing to migrate.",
    cardEyebrow: "Account-manager setup",
    oldPrice: "$149",
    freeLabel: "FREE",
    limited: "Limited time — setup goes back to $149 soon",
    bullets: [
      "Store connected — Shopify, Woo & more",
      "WhatsApp live — keep your number & green tick",
      "Carriers wired — labels & tracking automated",
      "7-day money-back — no questions asked",
    ],
    primary: "Start my free setup",
    secondary: "Prefer to talk first? Book a meet ↗",
    rating: "4.9/5",
    ratingNote: "loved by 200+ stores",
    partnerMeta: "Meta Business Partner",
    partnerShopify: "Shopify Official App",
    quote: "“Our business has been thriving since we started using Jawabify.” — Abdellah, TheWolfz.com",
  },
  ar: {
    eyebrow: "بلا أي مخاطرة",
    titleA: "إعداد مجاني.",
    titleB: "أحبّه خلال 7 أيام — أو استرجع نقودك.",
    sub: "أكّد طلبات أكثر. قلّل الإرجاعات. احتفظ بهامش أكبر. فريقنا يبني كل شيء لك — وتحتفظ بمتجرك، شركات الشحن، ورقمك على واتساب. لا شيء للترحيل.",
    cardEyebrow: "إعداد مدير حساب",
    oldPrice: "$149",
    freeLabel: "مجاناً",
    limited: "لوقت محدود — السعر سيعود إلى 149$ قريباً",
    bullets: [
      "ربط المتجر — Shopify وWoo وغيرها",
      "واتساب يعمل — احتفظ برقمك والعلامة الخضراء",
      "ربط شركات الشحن — الملصقات والتتبع آلياً",
      "استرجاع خلال 7 أيام — بلا أسئلة",
    ],
    primary: "ابدأ إعدادي المجاني",
    secondary: "تفضّل التحدث أولاً؟ احجز اجتماعاً ↗",
    rating: "4.9/5",
    ratingNote: "موثوق به من أكثر من 200 متجر",
    partnerMeta: "شريك أعمال Meta",
    partnerShopify: "تطبيق Shopify الرسمي",
    quote: "“عملنا يزدهر منذ أن بدأنا باستخدام جوابيفاي.” — عبد الله، TheWolfz.com",
  },
  fr: {
    eyebrow: "100% sans risque",
    titleA: "Setup gratuit.",
    titleB: "Adoptez-le en 7 jours — ou remboursé.",
    sub: "Confirmez plus de commandes. Réduisez les retours. Gardez plus de marge. Notre équipe installe tout — vous gardez votre boutique, vos transporteurs et votre numéro WhatsApp. Rien à migrer.",
    cardEyebrow: "Setup par account manager",
    oldPrice: "$149",
    freeLabel: "OFFERT",
    limited: "Durée limitée — le setup repassera à 149$",
    bullets: [
      "Boutique connectée — Shopify, Woo & plus",
      "WhatsApp en ligne — gardez votre numéro & coche verte",
      "Transporteurs branchés — étiquettes & tracking auto",
      "Remboursé sous 7 jours — sans question",
    ],
    primary: "Démarrer mon setup gratuit",
    secondary: "Préférez parler d'abord ? Réservez un call ↗",
    rating: "4.9/5",
    ratingNote: "adoré par 200+ boutiques",
    partnerMeta: "Partenaire Meta Business",
    partnerShopify: "App officielle Shopify",
    quote: "“Notre business cartonne depuis qu'on utilise Jawabify.” — Abdellah, TheWolfz.com",
  },
};

const RiskFree = ({ lang }: { lang: Lang }) => {
  const c = RISKFREE_COPY[contentLang(lang)];
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-[#06120f] py-20 text-white sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.30),transparent_55%),radial-gradient(ellipse_at_bottom_left,hsl(var(--primary)/0.18),transparent_60%)]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {c.eyebrow}
        </div>
        <h2 className="mt-5 max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          {c.titleA}{" "}
          <span className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
            {c.titleB}
          </span>
        </h2>
        <p className="mt-6 max-w-2xl text-white/70">{c.sub}</p>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* Setup pass card */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white p-8 text-foreground shadow-2xl sm:p-10">
            <div className="absolute right-6 top-6 rotate-6 rounded-md bg-yellow-300 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-yellow-950 shadow">
              Comped · $0
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{c.cardEyebrow}</p>
            <div className="mt-4 flex items-baseline gap-4">
              <span className="text-3xl font-semibold text-muted-foreground/70 line-through decoration-destructive/70 decoration-2">
                {c.oldPrice}
              </span>
              <span className="text-6xl font-extrabold tracking-tight text-primary sm:text-7xl">{c.freeLabel}</span>
            </div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-900">
              <Sparkles className="h-3.5 w-3.5" /> {c.limited}
            </div>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {c.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <Link to="/auth" replace className="mt-7 block" onClick={() => trackStartTrial({ content_name: "Info RiskFree CTA" })}>
              <Button size="lg" className="w-full rounded-full bg-[#06120f] text-white hover:bg-[#06120f]/90">
                {c.primary} <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <p className="mt-3 text-center text-xs text-muted-foreground">{c.secondary}</p>
          </div>

          {/* Trust card */}
          <div className="flex flex-col rounded-3xl border border-white/10 bg-white p-8 text-foreground shadow-2xl">
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" /> {c.partnerMeta}
              </div>
              <div className="flex items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3 text-sm font-semibold">
                <ShoppingBag className="h-4 w-4 text-primary" /> {c.partnerShopify}
              </div>
            </div>
            <p className="mt-6 text-sm italic leading-relaxed text-muted-foreground">{c.quote}</p>
          </div>
        </div>
      </div>
    </section>
  );
};


export default function Info() {
  const [lang, setLang] = useState<Lang>("en");
  const t = useMemo(() => DICT[contentLang(lang)], [lang]);
  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    trackViewContent({ content_name: "Info Page", content_category: "Marketing" });
  }, []);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": DICT.en.faq.items.map((f: { q: string; a: string }) => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a },
    })),
  };
  return (
    <div dir={dir} className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Jawabify Features — WhatsApp AI for Businesses</title>
        <meta name="description" content="See how Jawabify automates WhatsApp customer support, orders and campaigns across 20+ languages, with Shopify sync and voice‑message understanding." />
        <link rel="canonical" href="https://jawabify.com/info" />
        <meta property="og:title" content="Jawabify Features — WhatsApp AI for Businesses" />
        <meta property="og:description" content="Automate WhatsApp replies, orders and campaigns with a multilingual AI assistant. Built for restaurants, real estate, healthcare and e‑commerce." />
        <meta property="og:url" content="https://jawabify.com/info" />
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>
      <Nav lang={lang} setLang={setLang} t={t} />
      <main>
        <Hero lang={lang} t={t} />
        <StatStrip lang={lang} />
        <What lang={lang} t={t} />
        <ConfirmSpotlight lang={lang} />
        <Features lang={lang} t={t} />
        <Replaces lang={lang} />
        <Verticals lang={lang} t={t} />
        <Setup lang={lang} t={t} />
        <Pricing lang={lang} />
        <RiskFree lang={lang} />
        <Testimonials lang={lang} />
        <Referral lang={lang} />
        <Showcase lang={lang} />
        <FAQ lang={lang} t={t} />
        
        <CTA lang={lang} t={t} />
      </main>
      <Footer lang={lang} t={t} />
    </div>
  );
}
