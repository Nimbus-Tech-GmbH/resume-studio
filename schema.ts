// @ts-nocheck
import { graphql, list, ListConfig } from "@keystone-6/core";
import { allowAll } from "@keystone-6/core/access";
import { ListType } from "@keystone-6/core/dist/declarations/src/types/schema/graphql-ts-schema";
import {
  checkbox,
  float,
  image,
  integer,
  multiselect,
  password,
  relationship,
  select,
  text,
  timestamp,
  virtual,
} from "@keystone-6/core/fields";
import { BaseListTypeInfo } from "@keystone-6/core/types";

// --- Access Control ---
type AccessOperation = ListConfig<any>["access"];
const crud: AccessOperation = {
  operation: {
    query: allowAll,
    create: ({ session }) => session?.userGroup === "cms-admin",
    update: ({ session }) => session?.userGroup === "cms-admin",
    delete: ({ session }) => session?.userGroup === "cms-admin",
  },
};

// --- Keystone CMS Lists ---

export const lists: Record<string, ReturnType<typeof list>> = {
  // --- REQUIRED: User List for Authentication ---
  User: list({
    access: crud,
    fields: {
      authId: text({ isIndexed: "unique" }),
      userGroup: text({ validation: { isRequired: false } }),
      name: text({ validation: { isRequired: true } }),
      email: text({
        validation: { isRequired: true },
        isIndexed: "unique",
      }),
      password: password({ validation: { isRequired: true } }),
      createdAt: timestamp({
        defaultValue: { kind: "now" },
      }),
    },
  }),

  // --- Core Content Types ---
  Type: list({
    access: crud,
    fields: {
      label: select({
        options: [
          { label: "Certification", value: "certification" },
          { label: "CTA", value: "cta" },
          { label: "Hero", value: "hero" },
          { label: "Navigation", value: "navigation" },
          { label: "Testimonial", value: "testimonial" },
          { label: "Footer", value: "footer" },
          { label: "Main", value: "main" },
          { label: "Resume", value: "resume" },
        ],
      }),
    },
  }),

  // CTA: Call-to-action links
  Cta: list({
    access: crud,
    fields: {
      label: text({ validation: { isRequired: true } }),
      href: text({ validation: { isRequired: true } }),
      external: checkbox({ defaultValue: false }),
      type: relationship({ ref: "Type", many: false }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["label", "href", "type", "language"],
      },
    },
  }),

  // Image: Image metadata and configuration
  Image: list({
    access: crud,
    fields: {
      src: text({ validation: { isRequired: true } }),
      alt: text({ validation: { isRequired: true } }),
      width: integer(),
      height: integer(),
      fill: checkbox({ defaultValue: false }),
      type: relationship({ ref: "Type", many: false }),
      preview: virtual({
        field: graphql.field({
          type: graphql.String,
          resolve(item) {
            return item.src;
          },
        }),
        ui: {
          views: "./admin/components/CustomImageCell",
          createView: { fieldMode: "hidden" },
          itemView: { fieldMode: "hidden" },
        },
      }),
    },
    ui: {
      listView: {
        initialColumns: ["id", "alt", "type", "preview"],
      },
    },
  }),

  // Language: Language selector options
  Language: list({
    access: crud,
    fields: {
      label: select({
        options: [
          { label: "English", value: "English" },
          { label: "German", value: "German" },
          { label: "Hindi", value: "Hindi" },
        ],
        validation: { isRequired: true },
        isIndexed: "unique",
      }),
      value: select({
        options: [
          { label: "en-US", value: "en-US" },
          { label: "de-DE", value: "de-DE" },
          { label: "en-IN", value: "en-IN" },
        ],
        validation: { isRequired: true },
        isIndexed: "unique",
      }),
    },
  }),

  // --- Testimonial Related ---

  // TestimonialBadge: Badge displayed on testimonials
  TestimonialBadge: list({
    access: crud,
    fields: {
      icon: text(),
      label: text(),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["label", "icon", "language"],
      },
    },
  }),

  // TestimonialItem: Individual testimonial
  TestimonialItem: list({
    access: crud,
    fields: {
      rating: float(),
      badge: relationship({ ref: "TestimonialBadge", many: false }),
      name: text({ validation: { isRequired: true } }),
      role: text({ validation: { isRequired: true } }),
      company: text({ validation: { isRequired: true } }),
      image: relationship({ ref: "Image", many: false }),
      content: text({
        ui: { displayMode: "textarea" },
        validation: { isRequired: true },
      }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["name", "role", "company", "language"],
      },
    },
  }),

  // TestimonialSection: Testimonial section with background and fallback
  TestimonialSection: list({
    access: crud,
    fields: {
      title: text(),
      background: relationship({ ref: "Image", many: true }),
      testimonials: relationship({ ref: "TestimonialItem", many: true }),
      fallback: relationship({ ref: "TestimonialItem", many: false }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["title", "language"],
      },
    },
  }),

  // --- Hero Related ---

  // HeroBannerAdditional: Additional content for hero banner
  HeroBannerAdditional: list({
    access: crud,
    fields: {
      icon: text(),
      text: text({ validation: { isRequired: true } }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["text", "icon", "language"],
      },
    },
  }),

  // HeroBanner: Hero banner configuration
  HeroBanner: list({
    access: crud,
    fields: {
      label: text({ validation: { isRequired: true } }),
      href: text({ validation: { isRequired: true } }),
      external: checkbox({ defaultValue: false }),
      icon: text(),
      additional: relationship({ ref: "HeroBannerAdditional", many: false }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["label", "href", "language"],
      },
    },
  }),

  // Hero: Complete hero section
  Hero: list({
    access: crud,
    fields: {
      title: text({ validation: { isRequired: true } }),
      description: text({ validation: { isRequired: true } }),
      subHeading: text({ validation: { isRequired: true } }),
      banner: relationship({ ref: "HeroBanner", many: false }),
      cta: relationship({ ref: "Cta", many: false }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["title", "subHeading", "language"],
      },
    },
  }),

  // --- Benefit ---

  // Benefit: Feature or benefit item
  Benefit: list({
    access: crud,
    fields: {
      icon: text({ validation: { isRequired: true } }),
      title: text({ validation: { isRequired: true } }),
      description: text({
        ui: { displayMode: "textarea" },
        validation: { isRequired: true },
      }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["title", "icon", "language"],
      },
    },
  }),

  // BenefitSection: Collection of benefits with title
  BenefitSection: list({
    access: crud,
    fields: {
      title: text({ validation: { isRequired: true } }),
      benefits: relationship({ ref: "Benefit", many: true }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["title", "language"],
      },
    },
  }),

  // --- FAQ ---

  // Faq: Frequently asked question item
  Faq: list({
    access: crud,
    fields: {
      question: text({ validation: { isRequired: true } }),
      answer: text({
        ui: { displayMode: "textarea" },
        validation: { isRequired: true },
      }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["question", "language"],
      },
    },
  }),

  // FaqSection: Collection of FAQs with title and description
  FaqSection: list({
    access: crud,
    fields: {
      title: text({ validation: { isRequired: true } }),
      description: text({ ui: { displayMode: "textarea" } }),
      faqs: relationship({ ref: "Faq", many: true }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["title", "language"],
      },
    },
  }),

  // --- Certification ---

  // Certification: Certification or credential
  Certification: list({
    access: crud,
    fields: {
      title: text({ validation: { isRequired: true } }),
      description: text({ ui: { displayMode: "textarea" } }),
      image: relationship({ ref: "Image", many: false }),
      link: text(),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["title", "link", "language"],
      },
    },
  }),

  // CertificationSection: Collection of certifications
  CertificationSection: list({
    access: crud,
    fields: {
      title: text({ validation: { isRequired: true } }),
      description: text({ ui: { displayMode: "textarea" } }),
      cta: relationship({ ref: "Cta", many: false }),
      certifications: relationship({ ref: "Certification", many: true }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["title", "language"],
      },
    },
  }),

  // --- Feature ---

  // Feature: Product or service feature
  Feature: list({
    access: crud,
    fields: {
      featureId: integer({ validation: { isRequired: true } }),
      title: text({ validation: { isRequired: true } }),
      description: text({ validation: { isRequired: true } }),
      longDescription: text({ ui: { displayMode: "textarea" } }),
      visualization: select({
        options: [
          { label: "Orbit", value: "OrbitFeatureVisualization" },
          { label: "Cloud", value: "CloudFeatureVisualization" },
          { label: "Architecture", value: "ArchitectureFeatureVisualization" },
        ],
      }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["featureId", "title", "language"],
      },
    },
  }),

  // --- Approach ---

  // ApproachStep: Individual step in approach/process
  ApproachStep: list({
    access: crud,
    fields: {
      stepId: integer({ validation: { isRequired: true } }),
      type: select({
        options: [
          { label: "Done", value: "done" },
          { label: "In Progress", value: "in progress" },
          { label: "Open", value: "open" },
        ],
        validation: { isRequired: true },
      }),
      title: text({ validation: { isRequired: true } }),
      description: text({
        ui: { displayMode: "textarea" },
        validation: { isRequired: true },
      }),
      activityTime: text({ validation: { isRequired: true } }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["stepId", "title", "type", "language"],
      },
    },
  }),

  // Approach: Complete approach/process section
  Approach: list({
    access: crud,
    fields: {
      title: text({ validation: { isRequired: true } }),
      description: text({
        ui: { displayMode: "textarea" },
        validation: { isRequired: true },
      }),
      steps: relationship({ ref: "ApproachStep", many: true }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["title", "language"],
      },
    },
  }),

  // --- Navigation ---

  // NavigationLink: Navigation menu item
  NavigationLink: list({
    access: crud,
    fields: {
      label: text({ validation: { isRequired: true } }),
      href: text({ validation: { isRequired: true } }),
      external: checkbox({ defaultValue: false }),
      icon: text(),
      language: relationship({ ref: "Language", many: false }),
      type: relationship({ ref: "Type", many: false }),
      sectionKey: relationship({ ref: "FooterSectionKey", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["label", "href", "type", "language"],
      },
    },
  }),

  // Navigation: Navigation section
  Navigation: list({
    access: crud,
    fields: {
      title: text({ validation: { isRequired: true } }),
      description: text({ ui: { displayMode: "textarea" } }),
      image: relationship({ ref: "Image", many: false }),
      cta: relationship({ ref: "Cta", many: false }),
      items: relationship({ ref: "NavigationLink", many: true }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["title", "language"],
      },
    },
  }),

  // --- Footer ---
  FooterSectionKey: list({
    access: crud,
    fields: {
      label: select({
        options: [
          { label: "services", value: "services" },
          { label: "company", value: "company" },
          { label: "resources", value: "resources" },
          { label: "social", value: "social" },
        ],
      }),
    },
  }),

  // FooterSection: Section in footer (e.g., Services, Company)
  FooterSection: list({
    access: crud,
    ui: {
      labelField: "displayLabel",
      listView: {
        initialColumns: ["displayLabel", "language"],
      },
    },
    fields: {
      displayLabel: virtual({
        field: graphql.field({
          type: graphql.String,
          async resolve(item, args, context) {
            const footerSection = await context.query.FooterSection.findOne({
              where: { id: item.id.toString() },
              query: "title { label }",
            });
            return footerSection?.title?.label || `Footer Section ${item.id}`;
          },
        }),
        ui: {
          createView: { fieldMode: "hidden" },
          itemView: { fieldMode: "hidden" },
          listView: { fieldMode: "read" },
        },
      }),
      title: relationship({
        ref: "FooterSectionKey",
        many: false,
      }),
      items: relationship({ ref: "NavigationLink", many: true }),
      language: relationship({ ref: "Language", many: false }),
    },
  }),

  // Footer: Complete footer configuration
  Footer: list({
    access: crud,
    fields: {
      title: text({ validation: { isRequired: true } }),
      sections: relationship({ ref: "FooterSection", many: true }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["title", "language"],
      },
    },
  }),

  // --- Analytics ---

  // AnalyticsStat: Analytics statistics summary
  AnalyticsStat: list({
    access: crud,
    fields: {
      totalDeployments: text({ validation: { isRequired: true } }),
      deploymentChange: text({ validation: { isRequired: true } }),
      deploymentChangePercent: text({ validation: { isRequired: true } }),
      changePeriod: text({ validation: { isRequired: true } }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["totalDeployments", "changePeriod", "language"],
      },
    },
  }),

  // AnalyticsSummaryItem: Individual analytics summary row
  AnalyticsSummaryItem: list({
    access: crud,
    fields: {
      name: text({ validation: { isRequired: true } }),
      deployments: text({ validation: { isRequired: true } }),
      uptime: text({ validation: { isRequired: true } }),
      clientSatisfaction: text({ validation: { isRequired: true } }),
      efficiency: text({ validation: { isRequired: true } }),
      revenueGrowth: text({ validation: { isRequired: true } }),
      bgColor: text(),
      changeType: select({
        options: [
          { label: "Positive", value: "positive" },
          { label: "Negative", value: "negative" },
        ],
        validation: { isRequired: true },
      }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["name", "deployments", "changeType", "language"],
      },
    },
  }),

  // Analytic: Complete analytics section
  Analytic: list({
    access: crud,
    fields: {
      heading: text({ validation: { isRequired: true } }),
      subheading: text({ validation: { isRequired: true } }),
      stats: relationship({ ref: "AnalyticsStat", many: false }),
      tableHeadings: multiselect({
        options: [
          { label: "Project", value: "project" },
          { label: "Deployments", value: "deployments" },
          { label: "Uptime", value: "uptime" },
          { label: "Client Sat.", value: "clientSatisfaction" },
          { label: "Efficiency", value: "efficiency" },
          { label: "Revenue Growth", value: "revenueGrowth" },
        ],
      }),
      summary: relationship({ ref: "AnalyticsSummaryItem", many: true }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["heading", "subheading", "language"],
      },
    },
  }),

  // --- About ---

  // Value: Company value item
  Value: list({
    access: crud,
    fields: {
      label: text({ validation: { isRequired: true } }),
      description: text({
        ui: { displayMode: "textarea" },
        validation: { isRequired: true },
      }),
      icon: text({ validation: { isRequired: true } }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["label", "icon", "language"],
      },
    },
  }),

  // About: About us section
  About: list({
    access: crud,
    fields: {
      heading: text({ validation: { isRequired: true } }),
      intro: text({
        ui: { displayMode: "textarea" },
        validation: { isRequired: true },
      }),
      valuesTitle: text({ validation: { isRequired: true } }),
      values: relationship({ ref: "Value", many: true }),
      closing: text({
        ui: { displayMode: "textarea" },
        validation: { isRequired: true },
      }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["heading", "valuesTitle", "language"],
      },
    },
  }),

  // --- Map ---

  // Map: Map section
  Map: list({
    access: crud,
    fields: {
      title: text({ validation: { isRequired: true } }),
      subheading: text({ validation: { isRequired: true } }),
      description: text({
        ui: { displayMode: "textarea" },
        validation: { isRequired: true },
      }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["title", "subheading", "language"],
      },
    },
  }),

  // --- CTA Section ---

  // CtaSection: Call-to-action section with background
  CtaSection: list({
    access: crud,
    fields: {
      title: text({ validation: { isRequired: true } }),
      description: text({ ui: { displayMode: "textarea" } }),
      ctas: relationship({ ref: "Cta", many: true }),
      background: relationship({ ref: "Image", many: true }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["title", "language"],
      },
    },
  }),

  // --- Page Structure ---

  // Section: Dynamic section for page composition
  Section: list({
    access: crud,
    fields: {
      type: select({
        options: [
          { label: "Hero", value: "hero" },
          { label: "Benefits", value: "benefits" },
          { label: "Features", value: "features" },
          { label: "FAQ", value: "faq" },
          { label: "FAQ Section", value: "faqSection" },
          { label: "Testimonials", value: "testimonials" },
          { label: "Certifications", value: "certifications" },
          { label: "Approach", value: "approach" },
          { label: "About", value: "about" },
          { label: "Analytics", value: "analytics" },
          { label: "Navigation", value: "navigation" },
          { label: "Footer", value: "footer" },
          { label: "CTA", value: "cta" },
          { label: "Map", value: "map" },
        ],
        validation: { isRequired: true },
      }),
      contentHero: relationship({ ref: "Hero", many: true }),
      contentBenefits: relationship({ ref: "BenefitSection", many: true }),
      contentFeatures: relationship({ ref: "Feature", many: true }),
      contentFaqSection: relationship({ ref: "FaqSection", many: true }),
      contentTestimonials: relationship({ ref: "TestimonialSection", many: true }),
      contentCertifications: relationship({ ref: "CertificationSection", many: true }),
      contentApproach: relationship({ ref: "Approach", many: true }),
      contentAbout: relationship({ ref: "About", many: true }),
      contentAnalytics: relationship({ ref: "Analytic", many: true }),
      contentNavigation: relationship({ ref: "Navigation", many: true }),
      contentFooter: relationship({ ref: "Footer", many: true }),
      contentCta: relationship({ ref: "CtaSection", many: true }),
      contentMap: relationship({ ref: "Map", many: true }),
    },
  }),

  // PageContent: Complete page configuration
  PageContent: list({
    access: crud,
    fields: {
      slug: text({
        validation: { isRequired: true },
        isIndexed: "unique",
      }),
      title: text({ validation: { isRequired: true } }),
      description: text({ ui: { displayMode: "textarea" } }),
      image: relationship({ ref: "Image", many: false }),
      cta: relationship({ ref: "Cta", many: false }),
      sections: relationship({ ref: "Section", many: false }),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["slug", "title", "language"],
      },
    },
  }),

  // --- Resume ---

  // ResumeLocation: Physical location information
  ResumeLocation: list({
    access: crud,
    fields: {
      address: text(),
      postalCode: text(),
      city: text({ validation: { isRequired: true } }),
      countryCode: text(),
      region: text(),
      language: relationship({ ref: "Language", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["city", "countryCode", "language"],
      },
    },
  }),

  // ResumeProfile: Social media profile
  ResumeProfile: list({
    access: allowAll,
    fields: {
      network: select({
        options: [
          { label: "LinkedIn", value: "LinkedIn" },
          { label: "GitHub", value: "GitHub" },
          { label: "Twitter", value: "Twitter" },
          { label: "Instagram", value: "Instagram" },
          { label: "Literal", value: "Literal" },
          { label: "Other", value: "Other" },
        ],
        validation: { isRequired: true },
      }),
      username: text({ validation: { isRequired: true } }),
      url: text({ validation: { isRequired: true } }),
      language: relationship({ ref: "Language", many: false }),
    },
  }),

  // ResumeBasicInformation: Basic personal information
  ResumeBasicInformation: list({
    access: allowAll,
    fields: {
      name: text({ validation: { isRequired: true } }),
      label: text({ validation: { isRequired: true } }),
      image: relationship({ ref: "Image", many: false }),
      email: text({
        validation: {
          isRequired: true,
          match: {
            regex: /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/,
            explanation: "The pattern ensures the email address is valid.",
          },
        },
      }),
      phone: text({
        validation: {
          match: {
            regex: /^(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
            explanation:
              "The pattern ensures the phone number contains exactly 10 digits (3-3-4 format), with an optional 1-2 digit international prefix.",
          },
        },
      }),
      url: text(),
      summary: text({ ui: { displayMode: "textarea" } }),
      location: relationship({ ref: "ResumeLocation", many: false }),
      profiles: relationship({ ref: "ResumeProfile", many: true }),
      language: relationship({ ref: "Language", many: false }),
      resume: relationship({ ref: "Resume.basicInformation", many: false }),
    },
  }),

  // ResumeHighlight: Individual highlight bullet for a work entry
  // FIX: ref points to ResumeWork.highlights (two-way), NOT Resume.work
  ResumeHighlight: list({
    access: allowAll,
    fields: {
      value: text({ validation: { isRequired: true } }),
      work: relationship({ ref: "ResumeWork.highlights", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["value", "work"],
      },
    },
  }),

  // --- Work Experience ---
  ResumeWork: list({
    access: crud,
    fields: {
      name: text({ validation: { isRequired: true } }),
      position: text({ validation: { isRequired: true } }),
      url: text({ validation: { isRequired: false } }),
      startDate: timestamp({ validation: { isRequired: true } }),
      endDate: timestamp(),
      summary: text({ ui: { displayMode: "textarea" } }),
      // FIX: highlights now points back to ResumeHighlight.work (two-way pair)
      highlights: relationship({
        ref: "ResumeHighlight.work",
        many: true,
        ui: {
          displayMode: "cards",
          cardFields: ["value"],
          inlineEdit: { fields: ["value"] },
          inlineCreate: { fields: ["value"] },
        },
      }),
      image: relationship({ ref: "Image", many: false }),
      language: relationship({ ref: "Language", many: false }),
      resume: relationship({ ref: "Resume.work", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["name", "position", "startDate", "language"],
      },
    },
  }),

  // --- Volunteer Experience ---
  ResumeVolunteer: list({
    access: crud,
    fields: {
      organization: text({ validation: { isRequired: true } }),
      position: text({ validation: { isRequired: true } }),
      url: text(),
      startDate: timestamp(),
      endDate: timestamp(),
      summary: text({ ui: { displayMode: "textarea" } }),
      highlights: text({ ui: { displayMode: "textarea" } }),
      language: relationship({ ref: "Language", many: false }),
      resume: relationship({ ref: "Resume.volunteer", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["organization", "position", "language"],
      },
    },
  }),

  // --- Education ---
  ResumeEducation: list({
    access: crud,
    fields: {
      institution: text({ validation: { isRequired: true } }),
      url: text(),
      area: text(),
      studyType: text(),
      startDate: timestamp(),
      endDate: timestamp(),
      score: text(),
      courses: text({ ui: { displayMode: "textarea" } }),
      language: relationship({ ref: "Language", many: false }),
      resume: relationship({ ref: "Resume.education", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["institution", "area", "studyType", "language"],
      },
    },
  }),

  // --- Awards ---
  ResumeAward: list({
    access: crud,
    fields: {
      title: text({ validation: { isRequired: true } }),
      date: timestamp(),
      awarder: text({ validation: { isRequired: true } }),
      summary: text({ ui: { displayMode: "textarea" } }),
      url: text(),
      language: relationship({ ref: "Language", many: false }),
      resume: relationship({ ref: "Resume.awards", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["title", "awarder", "date", "language"],
      },
    },
  }),

  // --- Publications ---
  ResumePublication: list({
    access: crud,
    fields: {
      name: text({ validation: { isRequired: true } }),
      publisher: text({ validation: { isRequired: true } }),
      releaseDate: timestamp(),
      url: text(),
      summary: text({ ui: { displayMode: "textarea" } }),
      language: relationship({ ref: "Language", many: false }),
      resume: relationship({ ref: "Resume.publications", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["name", "publisher", "releaseDate", "language"],
      },
    },
  }),

  // --- Skills ---
  ResumeSkill: list({
    access: crud,
    fields: {
      name: text({ validation: { isRequired: true } }),
      level: select({
        options: [
          { label: "Beginner", value: "Beginner" },
          { label: "Intermediate", value: "Intermediate" },
          { label: "Advanced", value: "Advanced" },
          { label: "Expert", value: "Expert" },
          { label: "Master", value: "Master" },
        ],
      }),
      keywords: text({ ui: { displayMode: "textarea" } }),
      language: relationship({ ref: "Language", many: false }),
      resume: relationship({ ref: "Resume.skills", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["name", "level", "language"],
      },
    },
  }),

  // --- Languages ---
  ResumeLanguage: list({
    access: crud,
    fields: {
      language: text({ validation: { isRequired: true } }),
      fluency: select({
        options: [
          { label: "Elementary", value: "Elementary" },
          { label: "Limited Working", value: "Limited Working" },
          { label: "Professional Working", value: "Professional Working" },
          { label: "Full Professional", value: "Full Professional" },
          { label: "Native", value: "Native" },
        ],
      }),
      uiLanguage: relationship({ ref: "Language", many: false }),
      resume: relationship({ ref: "Resume.resumeLanguages", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["language", "fluency", "uiLanguage"],
      },
    },
  }),

  // --- Interests ---
  ResumeInterest: list({
    access: crud,
    fields: {
      name: text({ validation: { isRequired: true } }),
      keywords: text({ ui: { displayMode: "textarea" } }),
      language: relationship({ ref: "Language", many: false }),
      resume: relationship({ ref: "Resume.interests", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["name", "language"],
      },
    },
  }),

  // --- References ---
  ResumeReference: list({
    access: crud,
    fields: {
      name: text({ validation: { isRequired: true } }),
      reference: text({
        ui: { displayMode: "textarea" },
        validation: { isRequired: true },
      }),
      language: relationship({ ref: "Language", many: false }),
      resume: relationship({ ref: "Resume.references", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["name", "language"],
      },
    },
  }),

  // --- Projects ---
  ResumeProject: list({
    access: crud,
    fields: {
      name: text({ validation: { isRequired: true } }),
      startDate: timestamp(),
      endDate: timestamp(),
      description: text({
        ui: { displayMode: "textarea" },
        validation: { isRequired: true },
      }),
      highlights: text({ ui: { displayMode: "textarea" } }),
      url: text(),
      image: relationship({ ref: "Image", many: false }),
      language: relationship({ ref: "Language", many: false }),
      resume: relationship({ ref: "Resume.projects", many: false }),
    },
    ui: {
      listView: {
        initialColumns: ["name", "startDate", "language"],
      },
    },
  }),

  // Resume: Top-level resume record
  Resume: list({
    access: crud,
    fields: {
      title: text({ validation: { isRequired: true }, isIndexed: "unique" }),
      basicInformation: relationship({
        ref: "ResumeBasicInformation.resume",
        many: false,
      }),
      work: relationship({ ref: "ResumeWork.resume", many: true }),
      volunteer: relationship({ ref: "ResumeVolunteer.resume", many: true }),
      education: relationship({ ref: "ResumeEducation.resume", many: true }),
      awards: relationship({ ref: "ResumeAward.resume", many: true }),
      certificates: relationship({ ref: "Certification", many: true }),
      publications: relationship({ ref: "ResumePublication.resume", many: true }),
      skills: relationship({ ref: "ResumeSkill.resume", many: true }),
      resumeLanguages: relationship({ ref: "ResumeLanguage.resume", many: true }),
      interests: relationship({ ref: "ResumeInterest.resume", many: true }),
      references: relationship({ ref: "ResumeReference.resume", many: true }),
      projects: relationship({ ref: "ResumeProject.resume", many: true }),
      language: relationship({ ref: "Language", many: false }),
      createdAt: timestamp({ defaultValue: { kind: "now" } }),
      updatedAt: timestamp({ db: { updatedAt: true } }),
    },
    ui: {
      listView: {
        initialColumns: ["title", "language", "createdAt", "updatedAt"],
      },
    },
  }),
};
