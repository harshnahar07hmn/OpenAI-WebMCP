"use client";

import { useState } from "react";
import { useInterview } from "@/lib/store";
import type { CandidateProfile } from "@/lib/types";

export function ProfileForm() {
  const setProfile = useInterview((s) => s.setProfile);
  const [field, setField] = useState("Software Engineering");
  const [position, setPosition] = useState("Backend Engineer");
  const [experienceYears, setExperienceYears] = useState(3);
  const [skillsText, setSkillsText] = useState("Python, PostgreSQL, AWS");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const profile: CandidateProfile = {
      field: field.trim(),
      position: position.trim(),
      experienceYears: Number(experienceYears),
      skills: skillsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    setProfile(profile);
  }

  return (
    <form onSubmit={onSubmit} className="card p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Candidate profile</h2>
        <p className="text-sm text-gray-400 mt-1">
          Fill this in, or ask ChatGPT to <em>&quot;set my profile&quot;</em> and let the agent call
          <code className="bg-white/10 rounded px-1 mx-1">set_candidate_profile</code> for you.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-gray-400">Field</span>
          <input
            className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent"
            value={field}
            onChange={(e) => setField(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-gray-400">Target position</span>
          <input
            className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-gray-400">Years of experience</span>
          <input
            type="number"
            min={0}
            max={50}
            className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent"
            value={experienceYears}
            onChange={(e) => setExperienceYears(Number(e.target.value))}
            required
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-gray-400">Skills (comma-separated)</span>
          <input
            className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-accent"
            value={skillsText}
            onChange={(e) => setSkillsText(e.target.value)}
          />
        </label>
      </div>

      <button
        type="submit"
        className="bg-accent hover:bg-accent/80 text-black font-semibold rounded-lg px-4 py-2 transition"
      >
        Save profile
      </button>
    </form>
  );
}
