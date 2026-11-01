import { useState, useEffect, useCallback, FormEvent } from 'react';
import {
  ediensApi,
  HouseholdSummary,
  HouseholdMember,
  EdiensApiError,
} from '../../api/client';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input, FormField, FormLabel, FormError } from '../../components/ui/Input';
import {
  Copy,
  Check,
  Users,
  Shield,
  UserCheck,
  PlusCircle,
  Loader2,
  Calendar,
  Share2,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface HouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeHousehold: HouseholdSummary | null;
  onHouseholdJoined: (newHousehold: HouseholdSummary) => void;
  onShowToast: (title: string, desc: string, variant?: 'info' | 'success' | 'warning' | 'error') => void;
}

export function HouseholdModal({
  isOpen,
  onClose,
  activeHousehold,
  onHouseholdJoined,
  onShowToast,
}: HouseholdModalProps) {
  // Members list state
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState<boolean>(false);

  // Copy feedback state
  const [hasCopied, setHasCopied] = useState<boolean>(false);

  // Join by code form state
  const [inviteCodeInput, setInviteCodeInput] = useState<string>('');
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Fetch members for active household
  const loadMembers = useCallback(async () => {
    if (!activeHousehold?.id) return;
    setIsLoadingMembers(true);
    try {
      const data = await ediensApi.households.getMembers(activeHousehold.id);
      setMembers(data);
    } catch (err: unknown) {
      const msg =
        err instanceof EdiensApiError
          ? err.problem?.detail || err.message
          : 'Не вдалося завантажити перелік учасників';
      onShowToast('Помилка завантаження', msg, 'error');
    } finally {
      setIsLoadingMembers(false);
    }
  }, [activeHousehold?.id, onShowToast]);

  useEffect(() => {
    if (isOpen && activeHousehold?.id) {
      loadMembers();
    }
  }, [isOpen, activeHousehold?.id, loadMembers]);

  // Copy invite code to clipboard
  const handleCopyCode = async () => {
    if (!activeHousehold?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(activeHousehold.inviteCode);
      setHasCopied(true);
      onShowToast(
        'Код скопійовано',
        `Код запрошення "${activeHousehold.inviteCode}" збережено в буфер обміну.`,
        'success'
      );
      setTimeout(() => setHasCopied(false), 2500);
    } catch {
      onShowToast('Помилка буфера', 'Не вдалося скопіювати код у буфер обміну', 'warning');
    }
  };

  // Join household by code
  const handleJoinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setJoinError(null);

    const cleanCode = inviteCodeInput.trim();
    if (!cleanCode) {
      setJoinError('Будь ласка, введіть код запрошення.');
      return;
    }

    setIsJoining(true);
    try {
      const joinedHousehold = await ediensApi.households.joinHousehold(cleanCode);
      onShowToast(
        'Успішне приєднання',
        `Ви успішно приєдналися до сім'ї "${joinedHousehold.name}".`,
        'success'
      );
      setInviteCodeInput('');
      onHouseholdJoined(joinedHousehold);
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof EdiensApiError
          ? err.problem?.detail || err.message
          : 'Не вдалося приєднатися до сімʼї. Перевірте правильність коду.';
      setJoinError(msg);
      onShowToast('Помилка приєднання', msg, 'error');
    } finally {
      setIsJoining(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-sky-400" />
          <span>{activeHousehold ? activeHousehold.name : 'Домогосподарство'}</span>
        </div>
      }
      description="Керування учасниками, поширення коду запрошення та приєднання до спільних запасів"
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Закрити
        </Button>
      }
    >
      <div className="space-y-6 pt-1">
        {/* SECTION 1: Active Household & Invite Code Sharing */}
        {activeHousehold && (
          <div className="rounded-xl bg-zinc-900/90 border border-zinc-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-sky-400" />
                <span className="font-semibold text-xs text-zinc-200">Код запрошення до сім&apos;ї</span>
              </div>
              <span className="text-[11px] font-mono text-zinc-500">
                Ваша роль: <span className="text-zinc-300 font-semibold">{activeHousehold.role}</span>
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Поділіться цим кодом із родичами або співмешканцями, щоб надати їм спільний доступ до
              холодильника, макросів та списку покупок:
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <div className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded-lg px-3.5 py-2 font-mono text-sm font-bold tracking-wider text-sky-300 flex items-center justify-between select-all shadow-inner">
                <span>{activeHousehold.inviteCode}</span>
                <span className="text-[10px] text-zinc-500 font-sans font-normal uppercase">
                  Унікальний код
                </span>
              </div>

              <Button
                type="button"
                variant={hasCopied ? 'secondary' : 'default'}
                size="sm"
                onClick={handleCopyCode}
                icon={
                  hasCopied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )
                }
                className={cn(
                  'shrink-0 text-xs transition-colors',
                  hasCopied && 'border-emerald-600/50 text-emerald-300'
                )}
              >
                {hasCopied ? 'Скопійовано!' : 'Скопіювати код запрошення'}
              </Button>
            </div>
          </div>
        )}

        {/* SECTION 2: Members List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <Users className="h-4 w-4 text-amber-400" />
              <span>Учасники домогосподарства ({members.length})</span>
            </div>
            {isLoadingMembers && (
              <span className="text-[11px] text-zinc-500 flex items-center gap-1 font-mono">
                <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                Оновлення...
              </span>
            )}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800/80 overflow-hidden">
            {isLoadingMembers && members.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
                <span>Завантаження списку учасників...</span>
              </div>
            ) : members.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500">
                Немає зареєстрованих учасників
              </div>
            ) : (
              members.map((member) => {
                const isOwner = member.role.toLowerCase() === 'owner';
                return (
                  <div
                    key={member.userId}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-zinc-900/60 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border shrink-0',
                          isOwner
                            ? 'bg-amber-950/50 border-amber-800 text-amber-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                        )}
                      >
                        {member.email ? member.email[0].toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-zinc-200 truncate flex items-center gap-1.5">
                          <span>{member.email}</span>
                          {isOwner && (
                            <span title="Власник" className="inline-flex">
                              <Shield className="h-3 w-3 text-amber-400 shrink-0" />
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-500 flex items-center gap-1 font-mono">
                          <Calendar className="h-2.5 w-2.5" />
                          <span>Приєднався {formatDate(member.joinedAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full border',
                          isOwner
                            ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
                            : 'bg-sky-950/40 text-sky-300 border-sky-800/60'
                        )}
                      >
                        <UserCheck className="h-2.5 w-2.5" />
                        {member.role}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SECTION 3: Join Household by Code Input */}
        <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
            <PlusCircle className="h-4 w-4 text-emerald-400" />
            <span>Приєднатися до сім&apos;ї за кодом</span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Введіть отриманий код запрошення, щоб отримати доступ до запасів та списку покупок іншого
            домогосподарства:
          </p>

          <form onSubmit={handleJoinSubmit} className="space-y-2 pt-1">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2">
              <FormField className="flex-1">
                <FormLabel htmlFor="invite-code-input" className="sr-only">
                  Код запрошення
                </FormLabel>
                <Input
                  id="invite-code-input"
                  value={inviteCodeInput}
                  onChange={(e) => {
                    setInviteCodeInput(e.target.value);
                    if (joinError) setJoinError(null);
                  }}
                  placeholder="Введіть код, напр. EDIENS-77"
                  className="font-mono uppercase tracking-wide"
                  disabled={isJoining}
                />
              </FormField>

              <Button
                type="submit"
                variant="default"
                size="md"
                loading={isJoining}
                disabled={!inviteCodeInput.trim() || isJoining}
                className="shrink-0 text-xs sm:mt-0"
              >
                Приєднатися
              </Button>
            </div>

            {joinError && <FormError message={joinError} />}
          </form>
        </div>
      </div>
    </Modal>
  );
}
