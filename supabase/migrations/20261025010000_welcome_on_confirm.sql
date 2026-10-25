-- Automatically insert an in-app Welcome Notification into public.notifications
-- whenever a user confirms their email address in auth.users.

CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.notifications
      WHERE user_id = NEW.id
        AND message ILIKE '%Welcome to Inkwell%'
    ) THEN
      INSERT INTO public.notifications (
        id,
        user_id,
        actor_id,
        type,
        title,
        message,
        link,
        is_read,
        created_at
      )
      VALUES (
        'notif_welcome_' || SUBSTRING(NEW.id::text FROM 1 FOR 8) || '_' || EXTRACT(EPOCH FROM NOW())::bigint::text,
        NEW.id,
        NEW.id,
        'new_follower',
        'Welcome to Inkwell',
        '✦ Welcome to Inkwell! Your email is verified — tap to set up your writer profile and start your first story.',
        '/app/profile',
        false,
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block auth confirmation if notification schema differs
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;

CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_user_email_confirmed();
