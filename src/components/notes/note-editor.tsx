"use client";

// The note editor implementation (dialog with autosave, templates and entity
// pickers) lives in ./note-editor-dialog. This module keeps the historical
// import path `@/components/notes/note-editor` working with the same component.
import { NoteEditorDialog, type NoteEditorDialogProps } from "./note-editor-dialog";

export const NoteEditor = NoteEditorDialog;

export type NoteEditorProps = NoteEditorDialogProps;