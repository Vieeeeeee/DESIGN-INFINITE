import promptConfig from './prompts.json';

/**
 * 将 JSON 配置转换为发送给 AI 的完整提示词
 */
export const buildSystemPrompt = (): string => {
  const sections: string[] = [];

  // Project Header
  sections.push(`[PROJECT: ${promptConfig.project_name} v${promptConfig.version}]`);

  // Domain Definition
  sections.push(`\n[DOMAIN]\n- Type: ${promptConfig.domain_definition.photography_type}\n- Intent: ${promptConfig.domain_definition.usage_intent}`);

  // Global Constraints
  const gc = promptConfig.global_constraints;
  sections.push(`\n[GLOBAL CONSTRAINTS]
- PHOTOREALISM: ${gc.photorealism_only}
- LIGHTING: ${gc.lighting}
- TIME CONSISTENCY: ${gc.time_consistency}
- MATERIALS: ${gc.materials}
- COLOR PALETTE: ${gc.color_palette}
- SAME WORLD RULE: ${gc.same_world_rule}
- AESTHETIC LINEAGE: ${gc.aesthetic_lineage}`);

  // Camera System
  const cam = promptConfig.camera_system;
  sections.push(`\n[CAMERA SYSTEM]
- Lens Options: ${cam.lens_options_mm.join('mm, ')}mm
- Aperture: ${cam.aperture_guideline}
- Camera Height: ${cam.camera_height}`);

  // Grid Specification
  const grid = promptConfig.grid_specification;
  sections.push(`\n[GRID SPECIFICATION]
- Canvas: ${grid.final_canvas}
- Layout: ${grid.grid_layout}
- Dividers: ${grid.dividers}
- No Spanning: ${grid.no_spanning_rule}`);

  // Shot Guidelines
  const shots = promptConfig.shot_guidelines;
  sections.push(`\n[SHOT GUIDELINES]
- Variation: ${shots.variation}
- Anti-Redundancy: ${shots.anti_redundancy}
- Focus Shift: ${shots.focus_shift}`);

  // Design Reference Rules
  const drr = promptConfig.design_reference_rules;
  sections.push(`\n[DESIGN REFERENCE RULES]
- Scale: ${drr.scale_legibility}
- Constructability: ${drr.constructability}
- Readability: ${drr.readability_priority}`);

  // Output Rules
  const out = promptConfig.output_rules;
  sections.push(`\n[OUTPUT RULES]
- Aspect Ratio: ${out.aspect_ratio}
- Text: ${out.text_overlay}
- People: ${out.people}
- Consistency: ${out.consistency}`);

  // Final Instruction
  sections.push(`\n[FINAL INSTRUCTION]\n${promptConfig.final_prompt_instruction}`);

  return sections.join('\n');
};

/**
 * 获取生成配置（滑杆等级）
 * 等级1：严格遵循参考图 → 等级5：完全依据标签重构
 */
export const getGenerationConfig = (level: number) => {
  const configs = [
    { 
      temp: 0.3, 
      topP: 0.4, 
      promptDirective: "STRICTLY follow the source image. Maintain its spatial layout, color palette, material choices, and lighting atmosphere as closely as possible. The SPACE TAGS serve only as semantic labels for the existing content—do NOT redesign or alter the fundamental look and feel. Minimize deviation from the reference.", 
      bias: "参考图主导" 
    },
    { 
      temp: 0.5, 
      topP: 0.6, 
      promptDirective: "Prioritize the source image's overall atmosphere, material language, and spatial proportions. Allow the SPACE TAGS to guide minor adjustments in furniture or décor, but keep the core aesthetic anchored to the reference. Avoid drastic departures.", 
      bias: "参考图偏重" 
    },
    { 
      temp: 0.7, 
      topP: 0.75, 
      promptDirective: "Balance the source image and the SPACE TAGS equally. Borrow the reference's color tones and material hints, while letting the tags shape the functional identity and layout. Each panel should feel like a plausible reinterpretation of the same design world.", 
      bias: "平衡模式" 
    },
    { 
      temp: 0.9, 
      topP: 0.85, 
      promptDirective: "Prioritize the SPACE TAGS over the source image. Treat the reference only as a loose mood board—extract general color temperature or texture cues, but redesign layout and composition to match the tags. Do NOT replicate the source framing.", 
      bias: "提示词偏重" 
    },
    { 
      temp: 1.1, 
      topP: 0.95, 
      promptDirective: "MANDATORY: Generate entirely based on the SPACE TAGS. The source image is merely a faint stylistic hint (e.g., warm vs cool palette). Fully reconstruct the space type, layout, and details according to the tags. Maximize creative freedom while maintaining photorealism and coherence.", 
      bias: "提示词主导" 
    }
  ];
  return configs[level - 1] || configs[2];
};

/**
 * 构建完整的生成提示词
 */
export const buildGenerationPrompt = (tags: string[], level: number): string => {
  const systemPrompt = buildSystemPrompt();
  const config = getGenerationConfig(level);
  
  if (tags.length === 0) {
    // 无标签时也加入 directive（使用当前等级的指令）
    return `[GENERATION DIRECTIVE]: ${config.promptDirective}

${systemPrompt}`;
  }
  
  const tagString = tags.join(', ');

  // Tag taxonomy: infer PRIMARY vs MODIFIER without relying on selection order.
  // PRIMARY: overall project / industry scene context (工装行业场景)
  // MODIFIER: functional zones / room types / qualifiers within a project
  const PRIMARY_TAGS = new Set([
    '办公', '酒店', '餐饮', '零售 / 商店', '医疗', '教育', '展览 / 展馆'
  ]);

  const primaryCandidates = tags.filter(t => PRIMARY_TAGS.has(t));
  const primaryTag = primaryCandidates.length > 0 ? primaryCandidates.join(' + ') : tags[0];

  const modifierTags = tags.filter(t => !PRIMARY_TAGS.has(t));
  const modifierString = modifierTags.length > 0 ? modifierTags.join(', ') : 'None';

  // 外部空间标签
  const EXTERIOR_TAGS = new Set(['门头', '户外区', '阳台']);
  
  // 内部空间标签（家装 + 工装空间类型）
  const INTERIOR_ONLY_TAGS = new Set([
    // 家装空间
    '客厅', '家用餐厅', '厨房', '卧室', '家用卫生间', '书房 / 工作区', '玄关', '儿童房', '多功能房',
    // 工装空间类型
    '大堂', '前台', '接待区', '会议室', '开放办公区', '独立办公室', '洽谈区', '展示区', '就餐区',
    '咖啡区', '休息区', '公共活动区', '客房', '健身房', '走廊', '电梯厅', '公共卫生间'
  ]);

  // 判断内外锁定：只看 modifier tags（功能空间），因为 PRIMARY（行业场景）本身不决定内外
  const hasExteriorOnly = modifierTags.length > 0 && modifierTags.every(t => EXTERIOR_TAGS.has(t));
  const hasInteriorOnly = modifierTags.length > 0 && modifierTags.every(t => INTERIOR_ONLY_TAGS.has(t));

  return `[MANDATORY REALISM]: PHOTOREALISTIC ARCHITECTURAL PHOTOGRAPHY (INTERIOR OR EXTERIOR AS REQUIRED BY TAGS).

[GENERATION DIRECTIVE]: ${config.promptDirective}

[SELECTED SPACE TAGS]: "${tagString}"
[PRIMARY CONTEXT TAG]: "${primaryTag}"
[MODIFIER TAGS]: "${modifierString}"

[TAG COMPOSITION RULE]:
- Interpret tags as ONE compound environment (intersection), not separate scenes.
- PRIMARY CONTEXT TAG defines the overall project/context.
- MODIFIER TAGS must be embedded WITHIN the primary context (e.g., "Restaurant + Public Restroom" = a public restroom that belongs to the restaurant project, sharing its material language and vibe).
- Do NOT produce generic primary-space shots that ignore modifier tags, and do NOT produce modifier-space shots that feel detached from the primary project.
- All 9 panels must remain within the same coherent space context; you may include only directly adjacent transition zones (e.g., entry corridor to the restroom) if they clearly belong to the same project.

[SPACE TYPE LOCK]:
${hasExteriorOnly
  ? '- HARD LOCK: ENTRANCE / EXTERIOR ONLY. All 9 panels MUST depict entrance / facade / exterior zones. Interior views are strictly forbidden.'
  : hasInteriorOnly
    ? '- HARD LOCK: INTERIOR ONLY. All 9 panels MUST depict interior spaces. Exterior / entrance views are strictly forbidden.'
    : '- SOFT LOCK: Mixed context allowed ONLY if spaces are directly connected within the same project (e.g., entrance leading into the primary interior).'}

[ANTI-REUSE / DEDUPLICATION]:
- Do NOT repeat the same base frame or the original source composition across multiple panels.
- No two panels may feel interchangeable; each must differ clearly in distance OR compositional emphasis OR cropped fragment.

${systemPrompt}`;
};

export { promptConfig };
