import { normalizeEthiopianPhone } from '@shared/phone';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError, OfflineError } from '../../api/client';
import { requestCode, updateMe, verifyCode } from '../../auth/session';
import { dropOthersWrites, flush } from '../../data/queue';
import { type Translate, useI18n } from '../../i18n';
import { BigButton, CalmBanner, CodeBoxes, Icon, NumberPad, PhoneDisplay, Screen } from '../../ui';
import { displayPhone, formatPhoneDigits, pressPhoneDigit } from './phone-digits';

const CODE_LENGTH = 6;

type Notice = { kind: 'error' | 'calm'; text: string } | null;

/** WEB-001 step 5: confirm the phone with an SMS code. The NumberPad only, as in the app. */
export function SignInScreen() {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [digits, setDigits] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'sending' | 'verifying' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [resendAt, setResendAt] = useState(0);
  const now = useNow(step === 'code');
  /** The last code sent automatically, so each code goes once. */
  const sent = useRef('');

  async function send(e164: string) {
    setBusy('sending');
    setNotice(null);
    try {
      const res = await requestCode(e164, language);
      setPhone(e164);
      setCode('');
      setResendAt(Date.now() + res.resend_after_s * 1000);
      setStep('code');
    } catch (err) {
      setNotice(problem(t, err));
    } finally {
      setBusy(null);
    }
  }

  const verify = useCallback(
    async (typed: string) => {
      setBusy('verifying');
      setNotice(null);
      try {
        const { user } = await verifyCode(phone, typed);
        // Writes left by someone else on this phone are never sent as this person; this
        // person's own unsent writes (a session that ended on its own) go out now.
        await dropOthersWrites(user.id);
        void flush();
        // The language chosen here follows the person to SMS and the app.
        if (user.language !== language) void updateMe({ language }).catch(() => undefined);
        navigate(user.calendar_pref ? '/invites' : '/setup/calendar', { replace: true });
      } catch (err) {
        setNotice(problem(t, err));
        setCode('');
        sent.current = '';
        setBusy(null);
      }
    },
    [phone, language, navigate, t],
  );

  // Android Chrome reads the code from the SMS (its last line is `@<host> #<code>`).
  useEffect(() => {
    if (step !== 'code' || !('OTPCredential' in window)) return;
    const ac = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ['sms'] }, signal: ac.signal } as CredentialRequestOptions)
      .then((cred) => {
        const otp = (cred as (Credential & { code?: string }) | null)?.code;
        if (otp && /^\d{6}$/.test(otp)) setCode(otp);
      })
      .catch(() => undefined);
    return () => ac.abort();
  }, [step]);

  // The sixth digit (typed or filled by WebOTP) sends the code: one less tap. Once per code.
  useEffect(() => {
    if (step !== 'code' || code.length !== CODE_LENGTH || busy || sent.current === code) return;
    sent.current = code;
    void verify(code);
  }, [step, code, busy, verify]);

  if (step === 'phone') {
    const e164 = normalizeEthiopianPhone(digits);
    return (
      <Screen
        title={t('phoneTitle')}
        help={{ title: t('phoneTitle'), body: t('phoneHelpBody') }}
        actions={
          <BigButton
            label={t('sendCode')}
            busy={busy === 'sending'}
            busyLabel={t('sending')}
            disabled={digits.length === 0}
            onClick={() => {
              if (!e164) setNotice({ kind: 'error', text: t('phoneInvalid') });
              else void send(e164);
            }}
          />
        }
      >
        <p>{t('phoneHint')}</p>
        <PhoneDisplay
          text={digits ? formatPhoneDigits(digits) : t('phonePlaceholder')}
          placeholder={!digits}
          spoken={t('phoneSpoken', { digits: digits.split('').join(' ') })}
        />
        <NoticeView notice={notice} />
        <NumberPad
          onDigit={(d) => {
            setNotice(null);
            setDigits((v) => pressPhoneDigit(v, d));
          }}
          onBackspace={() => setDigits((v) => v.slice(0, -1))}
        />
      </Screen>
    );
  }

  const waitS = Math.max(0, Math.ceil((resendAt - now) / 1000));
  return (
    <Screen
      title={t('codeTitle')}
      help={{ title: t('codeTitle'), body: t('codeHelpBody') }}
      actions={
        <BigButton
          label={t('confirmCode')}
          busy={busy === 'verifying'}
          busyLabel={t('checking')}
          disabled={code.length !== CODE_LENGTH}
          onClick={() => void verify(code)}
        />
      }
    >
      <p>{t('codeSentTo', { phone: displayPhone(phone) })}</p>
      <CodeBoxes code={code} spoken={t('codeSpoken', { count: code.length })} />
      <NoticeView notice={notice} />
      <NumberPad
        onDigit={(d) => {
          setNotice(null);
          setCode((v) => (v.length >= CODE_LENGTH ? v : v + d));
        }}
        onBackspace={() => setCode((v) => v.slice(0, -1))}
      />
      <BigButton
        label={waitS > 0 ? t('resendIn', { seconds: waitS }) : t('resendNow')}
        variant="secondary"
        icon="refresh"
        disabled={waitS > 0 || busy !== null}
        onClick={() => void send(phone)}
      />
      <BigButton
        label={t('changeNumber')}
        variant="secondary"
        disabled={busy === 'verifying'}
        onClick={() => {
          setStep('phone');
          setNotice(null);
        }}
      />
    </Screen>
  );
}

function NoticeView({ notice }: { notice: Notice }) {
  if (!notice) return null;
  if (notice.kind === 'calm') return <CalmBanner message={notice.text} />;
  return (
    <p className="inline-error" role="alert">
      <Icon name="error" />
      <span>{notice.text}</span>
    </p>
  );
}

/** What went wrong, in plain words (MOB-002 §6). No internet is calm, not an error. */
function problem(t: Translate, err: unknown): Notice {
  if (err instanceof OfflineError) return { kind: 'calm', text: t('needInternet') };
  if (!(err instanceof ApiError)) return { kind: 'error', text: t('errorGenericWhat') };
  switch (err.code) {
    case 'invalid_phone':
      return { kind: 'error', text: t('phoneInvalid') };
    case 'otp_rate_limited': {
      const s = Number(err.details?.retry_after_s ?? 60);
      return {
        kind: 'error',
        text: t('tooManyRequests', { minutes: Math.max(1, Math.ceil(s / 60)) }),
      };
    }
    case 'otp_invalid':
      return typeof err.details?.attempts_left === 'number'
        ? { kind: 'error', text: t('codeWrong', { count: err.details.attempts_left }) }
        : { kind: 'error', text: t('codeWrongNoCount') };
    case 'otp_expired':
      return { kind: 'error', text: t('codeExpired') };
    case 'otp_locked':
      return { kind: 'error', text: t('codeLocked') };
    default:
      return { kind: 'error', text: `${t('errorGenericWhat')} ${t('errorGenericWhatToDo')}` };
  }
}

/** The current time, ticking each second while `active` (the resend countdown). */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}
